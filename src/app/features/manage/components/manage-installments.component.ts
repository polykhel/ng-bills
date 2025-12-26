import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { List, LucideAngularModule, Pencil, Plus, Trash2 } from 'lucide-angular';
import type { Installment } from '@shared/types';
import { UtilsService } from '@services';

interface CardInfo {
  id: string;
  bankName: string;
  cardName: string;
}

@Component({
  selector: 'app-manage-installments',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './manage-installments.component.html',
})
export class ManageInstallmentsComponent {
  @Input() installments: Installment[] = [];
  @Input() cards: CardInfo[] = [];
  @Input() viewDate = new Date();

  @Output() sort = new EventEmitter<string>();
  @Output() addInstallment = new EventEmitter<void>();
  @Output() editInstallment = new EventEmitter<Installment>();
  @Output() deleteInstallment = new EventEmitter<string>();

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly List = List;

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

  progressLabel(inst: Installment): string {
    const status = this.utils.getInstallmentStatus(inst, this.viewDate);
    if (status.currentTerm > inst.terms) return 'Done';
    if (status.currentTerm < 1) return 'Pending';
    return `${status.currentTerm}/${inst.terms}`;
  }

  isActive(inst: Installment): boolean {
    return this.utils.getInstallmentStatus(inst, this.viewDate).isActive;
  }

  progressWidth(inst: Installment): string {
    const status = this.utils.getInstallmentStatus(inst, this.viewDate);
    return `${(status.currentTerm / inst.terms) * 100}%`;
  }

  trackInst = (_: number, inst: Installment) => inst.id;
}
