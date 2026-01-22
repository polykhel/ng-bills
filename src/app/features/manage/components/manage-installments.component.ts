import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { List, LucideAngularModule, Pencil, Plus, Trash2 } from 'lucide-angular';
import type { Installment, SortConfig } from '@shared/types';
import {
  AppStateService,
  CardService,
  InstallmentService,
  TransactionService,
  UtilsService,
} from '@services';

@Component({
  selector: 'app-manage-installments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './manage-installments.component.html',
})
export class ManageInstallmentsComponent {
  private appState = inject(AppStateService);
  private cardService = inject(CardService);
  private installmentService = inject(InstallmentService);
  private transactionService = inject(TransactionService);
  protected utils = inject(UtilsService);

  protected manageInstSort = signal<SortConfig>({ key: 'name', direction: 'asc' });

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly List = List;

  protected installments = this.installmentService.installments;
  protected viewDate = this.appState.viewDate;
  protected selectedProfileIds = this.appState.selectedProfileIds;
  protected multiProfileMode = this.appState.multiProfileMode;

  protected visibleCards = computed(() => {
    const multiMode = this.multiProfileMode();
    const selectedIds = this.selectedProfileIds();
    
    if (multiMode && selectedIds.length > 0) {
      return this.cardService.getCardsForProfiles(selectedIds);
    }
    return this.cardService.activeCards();
  });

  protected sortedInstallments = computed(() => {
    const visibleCardIds = new Set(this.visibleCards().map((c) => c.id));
    const filtered = this.installments().filter((inst) => visibleCardIds.has(inst.cardId));
    const sort = this.manageInstSort();
    const dir = sort.direction === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      const cardA = this.visibleCards().find((c) => c.id === a.cardId)?.bankName || '';
      const cardB = this.visibleCards().find((c) => c.id === b.cardId)?.bankName || '';
      switch (sort.key) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'card':
          return cardA.localeCompare(cardB) * dir;
        case 'startDate':
          return a.startDate.localeCompare(b.startDate) * dir;
        case 'monthly':
          return (a.monthlyAmortization - b.monthlyAmortization) * dir;
        case 'progress':
          const statA = this.utils.getInstallmentStatus(a, this.viewDate()).currentTerm;
          const statB = this.utils.getInstallmentStatus(b, this.viewDate()).currentTerm;
          return (statA - statB) * dir;
        default:
          return 0;
      }
    });
  });

  protected handleInstSort(key: string): void {
    const current = this.manageInstSort();
    this.manageInstSort.set({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    });
  }

  protected openAddInstallment(): void {
    this.appState.openInstallmentForm();
  }

  protected openEditInstallment(inst: Installment): void {
    this.appState.openInstallmentForm(inst.id);
  }

  protected handleDeleteInstallment(installmentId: string): void {
    if (this.installmentService.deleteInstallment(installmentId)) {
      void this.transactionService.deleteTransactionsWhere(
        (tx) =>
          Boolean(
            tx.recurringRule?.installmentGroupId === `installment-${installmentId}` &&
              tx.paymentMethod === 'cash',
          ),
      );
    }
  }

  protected cardLabel(cardId: string): string {
    const card = this.visibleCards().find((c) => c.id === cardId);
    return card ? `${card.bankName} - ${card.cardName}` : 'Unknown';
  }

  protected formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  }

  protected progressLabel(inst: Installment): string {
    const status = this.utils.getInstallmentStatus(inst, this.viewDate());
    if (status.currentTerm > inst.terms) return 'Done';
    if (status.currentTerm < 1) return 'Pending';
    return `${status.currentTerm}/${inst.terms}`;
  }

  protected isActive(inst: Installment): boolean {
    return this.utils.getInstallmentStatus(inst, this.viewDate()).isActive;
  }

  protected progressWidth(inst: Installment): string {
    const status = this.utils.getInstallmentStatus(inst, this.viewDate());
    return `${(status.currentTerm / inst.terms) * 100}%`;
  }

  trackInst = (_: number, inst: Installment) => inst.id;
}
