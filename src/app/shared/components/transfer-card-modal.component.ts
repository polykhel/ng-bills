import { ChangeDetectionStrategy, Component, effect, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { AppStateService, CardService, ProfileService } from '@services';
import { ModalComponent } from './modal.component';
import type { CreditCard } from '../types';

@Component({
  selector: 'app-transfer-card-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ModalComponent],
  templateUrl: './transfer-card-modal.component.html',
})
export class TransferCardModalComponent {
  card = signal<CreditCard | null>(null);
  selectedProfileId = '';

  availableProfiles = signal<any[]>([]);

  constructor(
    private cardService: CardService,
    public profileService: ProfileService,
    public appState: AppStateService
  ) {
    effect(() => {
      const modalState = this.appState.modalState();
      if (modalState.type === 'transfer-card') {
        const cardId = modalState.data?.cardId;
        if (cardId) {
          const foundCard = this.cardService.cards().find(c => c.id === cardId);
          this.card.set(foundCard || null);

          // Calculate available profiles
          const currentProfileId = this.profileService.activeProfileId();
          const available = this.profileService.profiles().filter(p => p.id !== currentProfileId);
          this.availableProfiles.set(available);
        }
      } else {
        this.card.set(null);
        this.selectedProfileId = '';
      }
    });
  }

  get isOpen(): boolean {
    return this.appState.modalState().type === 'transfer-card';
  }

  onSubmit(): void {
    if (this.card() && this.selectedProfileId) {
      this.cardService.transferCard(this.card()!.id, this.selectedProfileId);
      this.close();
    }
  }

  close(): void {
    this.selectedProfileId = '';
    this.card.set(null);
    this.appState.closeModal();
  }
}
