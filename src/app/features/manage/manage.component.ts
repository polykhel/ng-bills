import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { DataManagementComponent } from './components/data-management.component';
import { ManageCardsComponent } from './components/manage-cards.component';
import { ManageInstallmentsComponent } from './components/manage-installments.component';
import { ManageOneTimeBillsComponent } from './components/manage-one-time-bills.component';
import {
  AppStateService,
  ProfileService,
  CardService,
  StatementService,
  InstallmentService,
  CashInstallmentService,
  OneTimeBillService,
  UtilsService,
} from '../../core/services';
import type { SortConfig, CreditCard, Installment, OneTimeBill } from '../../shared/types';

@Component({
  selector: 'app-manage',
  standalone: true,
  imports: [CommonModule, DataManagementComponent, ManageCardsComponent, ManageInstallmentsComponent, ManageOneTimeBillsComponent],
  templateUrl: './manage.component.html',
})
export class ManageComponent {
  manageCardSort: SortConfig = { key: 'bankName', direction: 'asc' };
  manageInstSort: SortConfig = { key: 'name', direction: 'asc' };
  manageOneTimeBillSort: SortConfig = { key: 'dueDate', direction: 'asc' };

  @ViewChild('fileRef') fileInput?: ElementRef<HTMLInputElement>;

  constructor(
    private appState: AppStateService,
    private profileService: ProfileService,
    private cardService: CardService,
    private statementService: StatementService,
    private installmentService: InstallmentService,
    private cashInstallmentService: CashInstallmentService,
    private oneTimeBillService: OneTimeBillService,
    private utils: UtilsService,
  ) {}

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

  get oneTimeBills(): OneTimeBill[] {
    return this.oneTimeBillService.oneTimeBills();
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
    return this.visibleCards.map(c => ({ id: c.id, bankName: c.bankName, cardName: c.cardName }));
  }

  get sortedManageOneTimeBills(): OneTimeBill[] {
    const visibleCardIds = new Set(this.visibleCards.map(c => c.id));
    const filtered = this.oneTimeBills.filter(bill => visibleCardIds.has(bill.cardId));
    const dir = this.manageOneTimeBillSort.direction === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      const cardA = this.visibleCards.find(c => c.id === a.cardId)?.bankName || '';
      const cardB = this.visibleCards.find(c => c.id === b.cardId)?.bankName || '';
      switch (this.manageOneTimeBillSort.key) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'card':
          return cardA.localeCompare(cardB) * dir;
        case 'dueDate':
          return a.dueDate.localeCompare(b.dueDate) * dir;
        case 'amount':
          return (a.amount - b.amount) * dir;
        case 'isPaid':
          return ((a.isPaid ? 1 : 0) - (b.isPaid ? 1 : 0)) * dir;
        default:
          return 0;
      }
    });
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

  handleOneTimeBillSort(key: string): void {
    this.manageOneTimeBillSort = {
      key,
      direction: this.manageOneTimeBillSort.key === key && this.manageOneTimeBillSort.direction === 'asc' ? 'desc' : 'asc',
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
      this.oneTimeBillService.deleteOneTimeBillsForCard(cardId);
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

  openAddBill(): void {
    this.appState.openOneTimeBillModal();
  }

  openEditBill(bill: OneTimeBill): void {
    this.appState.openOneTimeBillModal(bill.id);
  }

  handleDeleteOneTimeBill(billId: string): void {
    this.oneTimeBillService.deleteOneTimeBill(billId);
  }

  triggerImport(): void {
    this.fileInput?.nativeElement.click();
  }

  exportProfile(): void {
    const profile = this.profiles.find(p => p.id === this.activeProfileId);
    if (!profile) {
      alert('No active profile found.');
      return;
    }

    const cards = this.cardService.cards().filter(c => c.profileId === profile.id);
    const cardIds = new Set(cards.map(c => c.id));
    const statements = this.statementService.statements().filter(s => cardIds.has(s.cardId));
    const installments = this.installmentService.installments().filter(i => cardIds.has(i.cardId));
    const cashInstallments = this.cashInstallmentService.cashInstallments().filter(ci => cardIds.has(ci.cardId));
    const oneTimeBills = this.oneTimeBillService.oneTimeBills().filter(b => cardIds.has(b.cardId));

    const exportData = {
      version: 1,
      type: 'profile-backup',
      profile,
      cards,
      statements,
      installments,
      cashInstallments,
      oneTimeBills,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-tracker-${profile.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async handleImportProfile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.profile || !Array.isArray(data.cards)) {
        throw new Error('Invalid file format. Expected profile and cards array.');
      }

      const existingProfile = this.profiles.find(p => p.name === data.profile.name);
      if (existingProfile) {
        throw new Error(`Profile "${data.profile.name}" already exists. Please rename it before importing.`);
      }

      // Create new profile
      this.profileService.addProfile(data.profile.name);
      const newProfileId = this.profileService.activeProfileId();

      const cardIdMap = new Map<string, string>();
      const installmentIdMap = new Map<string, string>();

      // Import cards with new IDs
      for (const card of data.cards as CreditCard[]) {
        const beforeIds = new Set(this.cardService.cards().map(c => c.id));
        this.cardService.addCard({
          bankName: card.bankName,
          cardName: card.cardName,
          dueDay: card.dueDay,
          cutoffDay: card.cutoffDay,
          color: card.color,
          isCashCard: card.isCashCard,
          profileId: newProfileId,
        });
        const newCard = this.cardService.cards().find(c => !beforeIds.has(c.id) && c.profileId === newProfileId && c.bankName === card.bankName && c.cardName === card.cardName);
        if (newCard) {
          cardIdMap.set(card.id, newCard.id);
        }
      }

      // Import statements
      if (Array.isArray(data.statements)) {
        for (const stmt of data.statements) {
          const newCardId = cardIdMap.get(stmt.cardId);
          if (!newCardId) continue;
          this.statementService.updateStatement(newCardId, stmt.monthStr, {
            amount: stmt.amount,
            isPaid: stmt.isPaid,
            isUnbilled: stmt.isUnbilled,
            customDueDate: stmt.customDueDate,
            adjustedAmount: stmt.adjustedAmount,
          });
        }
      }

      // Import installments
      if (Array.isArray(data.installments)) {
        for (const inst of data.installments as Installment[]) {
          const newCardId = cardIdMap.get(inst.cardId);
          if (!newCardId) continue;
          const beforeIds = new Set(this.installmentService.installments().map(i => i.id));
          this.installmentService.addInstallment({
            cardId: newCardId,
            name: inst.name,
            totalPrincipal: inst.totalPrincipal,
            terms: inst.terms,
            monthlyAmortization: inst.monthlyAmortization,
            startDate: inst.startDate,
          });
          const newInst = this.installmentService.installments().find(i => !beforeIds.has(i.id) && i.cardId === newCardId && i.name === inst.name);
          if (newInst) {
            installmentIdMap.set(inst.id, newInst.id);
          }
        }
      }

      // Import cash installments
      if (Array.isArray(data.cashInstallments)) {
        for (const ci of data.cashInstallments) {
          const newCardId = cardIdMap.get(ci.cardId);
          const newInstId = installmentIdMap.get(ci.installmentId);
          if (!newCardId || !newInstId) continue;
          this.cashInstallmentService.addCashInstallment({
            installmentId: newInstId,
            cardId: newCardId,
            term: ci.term,
            dueDate: ci.dueDate,
            amount: ci.amount,
            isPaid: ci.isPaid,
            name: ci.name,
          });
        }
      }

      // Import one-time bills
      if (Array.isArray(data.oneTimeBills)) {
        for (const bill of data.oneTimeBills as OneTimeBill[]) {
          const newCardId = cardIdMap.get(bill.cardId);
          if (!newCardId) continue;
          this.oneTimeBillService.addOneTimeBill({
            cardId: newCardId,
            name: bill.name,
            amount: bill.amount,
            dueDate: bill.dueDate,
            isPaid: bill.isPaid,
          });
        }
      }

      alert(`Profile "${data.profile.name}" imported successfully with ${cardIdMap.size} card(s).`);
    } catch (error: any) {
      console.error(error);
      alert('Failed to import: ' + (error?.message || 'Unknown error'));
    } finally {
      if (input) input.value = '';
    }
  }
}
