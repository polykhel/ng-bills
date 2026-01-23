import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, Input, signal } from '@angular/core';
import { ArrowRightLeft, CreditCard as RawCardIcon, LucideAngularModule, Pencil, Plus, Trash2 } from 'lucide-angular';
import {
  AppStateService,
  CardService,
  InstallmentService,
  ProfileService,
  StatementService,
  TransactionService,
} from '@services';
import type { CreditCard, SortConfig } from '@shared/types';

const CardIcon = RawCardIcon;

@Component({
  selector: 'app-manage-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './manage-cards.component.html',
})
export class ManageCardsComponent {
  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);
  private cardService = inject(CardService);
  private statementService = inject(StatementService);
  private installmentService = inject(InstallmentService);
  private transactionService = inject(TransactionService);

  @Input() multiProfileMode = false;
  @Input() profileName = '';

  protected manageCardSort = signal<SortConfig>({ key: 'bankName', direction: 'asc' });

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly ArrowRightLeft = ArrowRightLeft;
  readonly Trash2 = Trash2;
  readonly CardIcon = CardIcon;

  protected activeCards = this.cardService.activeCards;
  protected selectedProfileIds = this.appState.selectedProfileIds;

  protected visibleCards = computed(() => {
    const multiMode = this.multiProfileMode;
    const selectedIds = this.selectedProfileIds();
    
    if (multiMode && selectedIds.length > 0) {
      return this.cardService.getCardsForProfiles(selectedIds);
    }
    return this.activeCards();
  });

  protected sortedCards = computed(() => {
    const data = [...this.visibleCards()];
    const sort = this.manageCardSort();
    const dir = sort.direction === 'asc' ? 1 : -1;
    return data.sort((a, b) => {
      switch (sort.key) {
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
  });

  protected handleCardSort(key: string): void {
    const current = this.manageCardSort();
    this.manageCardSort.set({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    });
  }

  protected openAddCard(): void {
    this.appState.openCardForm();
  }

  protected openEditCard(card: CreditCard): void {
    this.appState.openCardForm(card.id);
  }

  protected openTransferCard(card: CreditCard): void {
    this.appState.openTransferCardModal(card.id);
  }

  protected handleDeleteCard(cardId: string): void {
    if (this.cardService.deleteCard(cardId)) {
      this.statementService.deleteStatementsForCard(cardId);
      this.installmentService.deleteInstallmentsForCard(cardId);
      // Delete ALL transactions associated with this card
      void this.transactionService.deleteTransactionsWhere(
        (tx) => tx.cardId !== undefined && tx.cardId === cardId,
      );
    }
  }

  trackCard = (_: number, card: CreditCard) => card.id;
}
