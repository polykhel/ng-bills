import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UtilsService } from '@services';

export interface CardDueItem {
  cardId: string;
  bankName: string;
  cardName: string;
  amount: number;
  isPaid: boolean;
  profileName?: string;
  multiProfileMode: boolean;
}

export interface CashInstallmentDueItem {
  id: string;
  name: string;
  term: number | string;
  amount: number;
  isPaid: boolean;
  bankName: string;
  cardName: string;
  profileName?: string;
  multiProfileMode: boolean;
}

@Component({
  selector: 'app-calendar-day',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-day.component.html',
})
export class CalendarDayComponent {
  @Input() dayNum = 1;
  @Input() isToday = false;
  @Input() cardsDue: CardDueItem[] = [];
  @Input() cashInstsDue: CashInstallmentDueItem[] = [];

  constructor(private utils: UtilsService) {
  }

  formatCurrency(amount: number): string {
    return this.utils.formatCurrency(amount);
  }

  formatTitle(bank: string, name: string, profileName?: string, multiProfileMode?: boolean): string {
    const profileSuffix = multiProfileMode && profileName ? ` (${profileName})` : '';
    return `${bank} - ${name}${profileSuffix}`;
  }

  formatCashTitle(cash: CashInstallmentDueItem): string {
    const profileSuffix = cash.multiProfileMode && cash.profileName ? ` (${cash.profileName})` : '';
    return `${cash.bankName} - ${cash.name} (${cash.term})${profileSuffix}`;
  }
}
