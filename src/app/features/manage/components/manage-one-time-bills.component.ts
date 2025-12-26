import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DollarSign, LucideAngularModule, Pencil, Plus, Trash2 } from 'lucide-angular';
import type { OneTimeBill } from '@shared/types';
import { UtilsService } from '@services';

interface CardInfo {
  id: string;
  bankName: string;
  cardName: string;
}

@Component({
  selector: 'app-manage-one-time-bills',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './manage-one-time-bills.component.html',
})
export class ManageOneTimeBillsComponent {
  @Input() bills: OneTimeBill[] = [];
  @Input() cards: CardInfo[] = [];
  @Input() viewDate = new Date();

  @Output() sort = new EventEmitter<string>();
  @Output() addBill = new EventEmitter<void>();
  @Output() editBill = new EventEmitter<OneTimeBill>();
  @Output() deleteBill = new EventEmitter<string>();

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly DollarSign = DollarSign;

  constructor(public utils: UtilsService) {
  }

  cardLabel(cardId: string): string {
    const card = this.cards.find(c => c.id === cardId);
    return card ? `${card.bankName} - ${card.cardName}` : 'Unknown';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  }

  trackBill = (_: number, bill: OneTimeBill) => bill.id;
}
