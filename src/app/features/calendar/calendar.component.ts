import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isValid,
  parseISO,
  setDate,
  startOfMonth
} from 'date-fns';

import {
  AppStateService,
  CardService,
  CashInstallmentService,
  InstallmentService,
  OneTimeBillService,
  ProfileService,
  StatementService,
  UtilsService,
} from '@services';
import type { Statement } from '@shared/types';
import { CalendarHeaderComponent } from './components/calendar-header.component';
import {
  CalendarDayComponent,
  CardDueItem,
  CashInstallmentDueItem,
  OneTimeBillDueItem,
} from './components/calendar-day.component';

interface CalendarDayView {
  key: string;
  dayNum: number;
  isToday: boolean;
  cardsDue: CardDueItem[];
  cashInstsDue: CashInstallmentDueItem[];
  billsDue: OneTimeBillDueItem[];
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, CalendarHeaderComponent, CalendarDayComponent],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent {
  daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(
    private appState: AppStateService,
    private profileService: ProfileService,
    private cardService: CardService,
    private statementService: StatementService,
    private installmentService: InstallmentService,
    private cashInstallmentService: CashInstallmentService,
    private oneTimeBillService: OneTimeBillService,
    private utils: UtilsService,
  ) {
  }

  get isLoaded(): boolean {
    return this.profileService.isLoaded();
  }

  get viewDate(): Date {
    return this.appState.viewDate();
  }

  get monthKey(): string {
    return format(this.viewDate, 'yyyy-MM');
  }

  get profiles() {
    return this.profileService.profiles();
  }

  get multiProfileMode(): boolean {
    return this.appState.multiProfileMode();
  }

  get selectedProfileIds(): string[] {
    return this.appState.selectedProfileIds();
  }

  get activeCards() {
    return this.cardService.activeCards();
  }

  get visibleCards() {
    if (this.multiProfileMode && this.selectedProfileIds.length > 0) {
      return this.cardService.getCardsForProfiles(this.selectedProfileIds);
    }
    return this.activeCards;
  }

  get statements() {
    return this.statementService.statements();
  }

  get monthlyStatements(): Statement[] {
    return this.statements.filter(stmt => stmt.monthStr === this.monthKey);
  }

  get installments() {
    return this.installmentService.installments();
  }

  get activeInstallments() {
    return this.installments
      .map(inst => ({...inst, status: this.utils.getInstallmentStatus(inst, this.viewDate)}))
      .filter(inst => inst.status.isActive);
  }

  get cashInstallments() {
    return this.cashInstallmentService.cashInstallments();
  }

  get activeCashInstallments() {
    return this.cashInstallments.filter(ci => {
      const dueDate = parseISO(ci.dueDate);
      if (!isValid(dueDate)) return false;
      return format(dueDate, 'yyyy-MM') === this.monthKey;
    });
  }

  get oneTimeBills() {
    return this.oneTimeBillService.oneTimeBills();
  }

  get activeOneTimeBills() {
    return this.oneTimeBills.filter(bill => {
      const dueDate = parseISO(bill.dueDate);
      if (!isValid(dueDate)) return false;
      return format(dueDate, 'yyyy-MM') === this.monthKey;
    });
  }

  get startDayIndex(): number {
    const start = startOfMonth(this.viewDate);
    return getDay(start);
  }

  get startFillers(): number[] {
    return Array.from({length: this.startDayIndex}).map((_, idx) => idx);
  }

  get calendarDays(): CalendarDayView[] {
    const start = startOfMonth(this.viewDate);
    const end = endOfMonth(this.viewDate);
    const days = eachDayOfInterval({start, end});

    return days.map(day => {
      const dayNum = day.getDate();
      const isToday = isSameDay(day, new Date());

      const cardsDue = this.visibleCards
        .filter(card => !card.isCashCard)
        .map(card => {
          const stmt = this.monthlyStatements.find(s => s.cardId === card.id);
          let targetDate = setDate(this.viewDate, card.dueDay);
          if (stmt?.customDueDate) {
            const parsed = parseISO(stmt.customDueDate);
            if (isValid(parsed)) targetDate = parsed;
          }
          return {card, stmt, targetDate} as const;
        })
        .filter(entry => isSameDay(entry.targetDate, day))
        .map(entry => {
          const {card, stmt} = entry;
          const amount = stmt ? stmt.amount : this.getCardInstallmentTotal(card.id);
          const profile = this.profiles.find(p => p.id === card.profileId);
          return {
            cardId: card.id,
            bankName: card.bankName,
            cardName: card.cardName,
            amount,
            isPaid: stmt?.isPaid || false,
            profileName: profile?.name,
            multiProfileMode: this.multiProfileMode,
          } satisfies CardDueItem;
        });

      const cashInstsDue = this.activeCashInstallments
        .filter(ci => {
          const card = this.visibleCards.find(c => c.id === ci.cardId);
          if (!card?.isCashCard) return false;
          const dueDate = parseISO(ci.dueDate);
          return isValid(dueDate) && isSameDay(dueDate, day);
        })
        .map(ci => {
          const card = this.visibleCards.find(c => c.id === ci.cardId)!;
          const profile = this.profiles.find(p => p.id === card.profileId);
          return {
            id: ci.id,
            name: ci.name,
            term: ci.term,
            amount: ci.amount,
            isPaid: ci.isPaid,
            bankName: card.bankName,
            cardName: card.cardName,
            profileName: profile?.name,
            multiProfileMode: this.multiProfileMode,
          } satisfies CashInstallmentDueItem;
        });

      const billsDue = this.activeOneTimeBills
        .filter(bill => {
          const card = this.visibleCards.find(c => c.id === bill.cardId);
          if (!card) return false;
          const dueDate = parseISO(bill.dueDate);
          return isValid(dueDate) && isSameDay(dueDate, day);
        })
        .map(bill => {
          const card = this.visibleCards.find(c => c.id === bill.cardId)!;
          const profile = this.profiles.find(p => p.id === card.profileId);
          return {
            id: bill.id,
            name: bill.name,
            amount: bill.amount,
            isPaid: bill.isPaid,
            bankName: card.bankName,
            cardName: card.cardName,
            profileName: profile?.name,
            multiProfileMode: this.multiProfileMode,
          } satisfies OneTimeBillDueItem;
        });

      return {
        key: day.toISOString(),
        dayNum,
        isToday,
        cardsDue,
        cashInstsDue,
        billsDue,
      } satisfies CalendarDayView;
    });
  }

  private getCardInstallmentTotal(cardId: string): number {
    return this.activeInstallments
      .filter(i => i.cardId === cardId)
      .reduce((acc, i) => acc + i.monthlyAmortization, 0);
  }
}
