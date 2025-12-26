import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ManageCardsComponent } from './components/manage-cards.component';
import { ManageInstallmentsComponent } from './components/manage-installments.component';
import {
  AppStateService,
  CardService,
  CashInstallmentService,
  InstallmentService,
  ProfileService,
  StatementService,
  UtilsService,
} from '@services';
import type { CreditCard, Installment, SortConfig } from '@shared/types';

@Component({
  selector: 'app-manage',
  standalone: true,
  imports: [CommonModule, ManageCardsComponent, ManageInstallmentsComponent],
  templateUrl: './manage.component.html',
})
export class ManageComponent {
  manageCardSort: SortConfig = {key: 'bankName', direction: 'asc'};
  manageInstSort: SortConfig = {key: 'name', direction: 'asc'};

  constructor(
    private appState: AppStateService,
    private profileService: ProfileService,
    private cardService: CardService,
    private statementService: StatementService,
    private installmentService: InstallmentService,
    private cashInstallmentService: CashInstallmentService,
    private utils: UtilsService,
  ) {
  }

  get viewDate(): Date {
    return this.appState.viewDate();
  }

  get profiles() {
    return this.profileService.profiles();
  }

  get activeProfileId(): string {
    return this.profileService.activeProfileId();
  }

  get activeProfileName(): string {
    return this.profiles.find(p => p.id === this.activeProfileId)?.name || '';
  }

  get multiProfileMode(): boolean {
    return this.appState.multiProfileMode();
  }

  get selectedProfileIds(): string[] {
    return this.appState.selectedProfileIds();
  }

  get activeCards(): CreditCard[] {
    return this.cardService.activeCards();
  }

  get visibleCards(): CreditCard[] {
    if (this.multiProfileMode && this.selectedProfileIds.length > 0) {
      return this.cardService.getCardsForProfiles(this.selectedProfileIds);
    }
    return this.activeCards;
  }

  get installments(): Installment[] {
    return this.installmentService.installments();
  }

  get sortedManageCards(): CreditCard[] {
    const data = [...this.visibleCards];
    const dir = this.manageCardSort.direction === 'asc' ? 1 : -1;
    return data.sort((a, b) => {
      switch (this.manageCardSort.key) {
        case 'bankName':
          return a.bankName.localeCompare(b.bankName) * dir;
        case 'cardName':
          return a.cardName.localeCompare(b.cardName) * dir;
        case 'dueDay':
          return (a.dueDay - b.dueDay) * dir;
        case 'cutoffDay':
          return (a.cutoffDay - b.cutoffDay) * dir;
        default:
          return 0;
      }
    });
  }

  get sortedManageInstallments(): Installment[] {
    const visibleCardIds = new Set(this.visibleCards.map(c => c.id));
    const filtered = this.installments.filter(inst => visibleCardIds.has(inst.cardId));
    const dir = this.manageInstSort.direction === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      const cardA = this.visibleCards.find(c => c.id === a.cardId)?.bankName || '';
      const cardB = this.visibleCards.find(c => c.id === b.cardId)?.bankName || '';
      switch (this.manageInstSort.key) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'card':
          return cardA.localeCompare(cardB) * dir;
        case 'startDate':
          return a.startDate.localeCompare(b.startDate) * dir;
        case 'monthly':
          return (a.monthlyAmortization - b.monthlyAmortization) * dir;
        case 'progress':
          const statA = this.utils.getInstallmentStatus(a, this.viewDate).currentTerm;
          const statB = this.utils.getInstallmentStatus(b, this.viewDate).currentTerm;
          return (statA - statB) * dir;
        default:
          return 0;
      }
    });
  }

  get cardOptions() {
    return this.visibleCards.map(c => ({id: c.id, bankName: c.bankName, cardName: c.cardName}));
  }

  handleCardSort(key: string): void {
    this.manageCardSort = {
      key,
      direction: this.manageCardSort.key === key && this.manageCardSort.direction === 'asc' ? 'desc' : 'asc',
    };
  }

  handleInstSort(key: string): void {
    this.manageInstSort = {
      key,
      direction: this.manageInstSort.key === key && this.manageInstSort.direction === 'asc' ? 'desc' : 'asc',
    };
  }

  openAddCard(): void {
    this.appState.openCardForm();
  }

  openEditCard(card: CreditCard): void {
    this.appState.openCardForm(card.id);
  }

  openTransferCard(card: CreditCard): void {
    this.appState.openTransferCardModal(card.id);
  }

  handleDeleteCard(cardId: string): void {
    if (this.cardService.deleteCard(cardId)) {
      this.statementService.deleteStatementsForCard(cardId);
      this.installmentService.deleteInstallmentsForCard(cardId);
      this.cashInstallmentService.deleteCashInstallmentsForCard(cardId);
    }
  }

  openAddInstallment(): void {
    this.appState.openInstallmentForm();
  }

  openEditInstallment(inst: Installment): void {
    this.appState.openInstallmentForm(inst.id);
  }

  handleDeleteInstallment(installmentId: string): void {
    if (this.installmentService.deleteInstallment(installmentId)) {
      this.cashInstallmentService.deleteCashInstallmentsForInstallment(installmentId);
    }
  }
}
