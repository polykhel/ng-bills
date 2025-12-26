import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ArrowRightLeft, CreditCard as RawCardIcon, LucideAngularModule, Pencil, Plus, Trash2 } from 'lucide-angular';
import type { CreditCard } from '@shared/types';

const CardIcon = RawCardIcon;

@Component({
  selector: 'app-manage-cards',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './manage-cards.component.html',
})
export class ManageCardsComponent {
  @Input() cards: CreditCard[] = [];
  @Input() multiProfileMode = false;
  @Input() profileName = '';
  @Input() currentSort: { key: string; direction: string } = {key: 'bankName', direction: 'asc'};

  @Output() addCard = new EventEmitter<void>();
  @Output() editCard = new EventEmitter<CreditCard>();
  @Output() transferCard = new EventEmitter<CreditCard>();
  @Output() deleteCard = new EventEmitter<string>();
  @Output() changeSort = new EventEmitter<string>();

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly ArrowRightLeft = ArrowRightLeft;
  readonly Trash2 = Trash2;
  readonly CardIcon = CardIcon;

  constructor() {
  }

  trackCard = (_: number, card: CreditCard) => card.id;
}
