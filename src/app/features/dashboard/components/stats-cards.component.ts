import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UtilsService } from '@services';

@Component({
  selector: 'app-stats-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats-cards.component.html',
})
export class StatsCardsComponent {
  @Input() bankBalanceTrackingEnabled = false;
  @Input() multiProfileMode = false;
  @Input() profilesCount = 1;
  @Input() currentBankBalance: number | null = null;
  @Input() balanceStatus = {isEnough: true, difference: 0};
  @Input() billTotal = 0;
  @Input() unpaidTotal = 0;
  @Input() installmentTotal = 0;

  @Output() disableTracking = new EventEmitter<void>();
  @Output() bankBalanceChange = new EventEmitter<number>();

  constructor(public utils: UtilsService) {
  }

  get absDifference(): number {
    return Math.abs(this.balanceStatus.difference);
  }

  onBalanceChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    const rounded = isNaN(value) ? 0 : this.utils.roundCurrency(value);
    this.bankBalanceChange.emit(rounded);
  }

  onBalanceBlur(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    if (!isNaN(value)) {
      const rounded = this.utils.roundCurrency(value);
      this.bankBalanceChange.emit(rounded);
      target.value = rounded.toFixed(2);
    }
  }
}
