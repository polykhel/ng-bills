
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UtilsService } from '@services';

@Component({
  selector: 'app-stats-cards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="grid gap-4"
      [ngClass]="bankBalanceTrackingEnabled ? ['grid-cols-1','md:grid-cols-2','lg:grid-cols-4'] : ['grid-cols-1','md:grid-cols-3']">
      @if (bankBalanceTrackingEnabled) {
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div class="flex items-center justify-between mb-2">
            <p class="text-slate-500 text-sm font-medium">
              Bank Balance
              @if (multiProfileMode && profilesCount > 1) {
                <span class="ml-2 text-[10px] text-amber-600 font-normal">(Sum of all profiles)</span>
              }
            </p>
            <button
              (click)="disableTracking.emit()"
              class="text-slate-400 hover:text-slate-600 text-xs"
              title="Disable bank balance tracking">
              ✕
            </button>
          </div>
          <div class="relative max-w-[200px]">
            <span class="absolute left-0 top-1/2 -translate-y-1/2 text-slate-800 text-2xl font-bold">₱</span>
            <input
              type="number"
              step="0.01"
              [disabled]="multiProfileMode && profilesCount > 1"
              class="w-full pl-5 pr-2 py-0 bg-transparent border-none focus:bg-slate-50 focus:ring-2 focus:ring-blue-200 rounded-lg text-3xl font-bold text-slate-800 transition-all"
              placeholder="0.00"
              [value]="currentBankBalance ?? ''"
              (change)="onBalanceChange($event)"
              (blur)="onBalanceBlur($event)"
              [title]="multiProfileMode && profilesCount > 1 ? 'Switch to single profile mode to edit bank balance' : ''"
            />
          </div>
          <div
            class="text-xs mt-2 font-medium flex items-center gap-1"
            [ngClass]="balanceStatus.isEnough ? 'text-green-600' : 'text-rose-600'">
            @if (balanceStatus.isEnough) {
              <span class="flex items-center gap-1">
                <span>✓</span>
                <span>₱{{ utils.formatCurrency(balanceStatus.difference) }} remaining</span>
              </span>
            } @else {
              <span class="flex items-center gap-1">
                <span>⚠</span>
                <span>₱{{ utils.formatCurrency(absDifference) }} short</span>
              </span>
            }
          </div>
        </div>
      }

      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <p class="text-slate-500 text-sm font-medium">Total Statement Balance</p>
        <p class="text-3xl font-bold text-slate-800 mt-2">₱{{ utils.formatCurrency(billTotal) }}</p>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <p class="text-slate-500 text-sm font-medium">Unpaid Balance</p>
        <p class="text-3xl font-bold text-rose-600 mt-2">₱{{ utils.formatCurrency(unpaidTotal) }}</p>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <p class="text-slate-500 text-sm font-medium">Monthly Installments</p>
        <p class="text-3xl font-bold text-blue-600 mt-2">₱{{ utils.formatCurrency(installmentTotal) }}</p>
        <p class="text-xs text-slate-400 mt-1">Included in statements if billed</p>
      </div>
    </div>
  `
})
export class StatsCardsComponent {
  @Input() bankBalanceTrackingEnabled = false;
  @Input() multiProfileMode = false;
  @Input() profilesCount = 1;
  @Input() currentBankBalance: number | null = null;
  @Input() balanceStatus = { isEnough: true, difference: 0 };
  @Input() billTotal = 0;
  @Input() unpaidTotal = 0;
  @Input() installmentTotal = 0;

  @Output() disableTracking = new EventEmitter<void>();
  @Output() bankBalanceChange = new EventEmitter<number>();

  constructor(public utils: UtilsService) {}

  get absDifference(): number {
    return Math.abs(this.balanceStatus.difference);
  }

  onBalanceChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    this.bankBalanceChange.emit(isNaN(value) ? 0 : value);
  }

  onBalanceBlur(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    if (!isNaN(value)) {
      this.bankBalanceChange.emit(parseFloat(value.toFixed(2)));
    }
  }
}
