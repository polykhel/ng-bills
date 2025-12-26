import { Component, signal, effect } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CardService, ProfileService, AppStateService } from '@services';
import { ModalComponent } from './modal.component';
import type { CreditCard } from '../types';

@Component({
  selector: 'app-transfer-card-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal 
      [isOpen]="isOpen" 
      [title]="'Transfer Card to Another Profile'"
      (onClose)="close()">
      @if (card()) {
        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p class="text-xs text-slate-500 mb-1">Transferring Card:</p>
            <div class="flex items-center gap-3">
              <div 
                class="w-10 h-7 rounded-md shadow-sm"
                [style.backgroundColor]="card()!.color || '#334155'">
              </div>
              <div>
                <p class="font-semibold text-slate-800">{{ card()!.cardName }}</p>
                <p class="text-xs text-slate-500">{{ card()!.bankName }}</p>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-700 mb-2">
              Select Target Profile
            </label>
            @if (availableProfiles().length === 0) {
              <p class="text-sm text-slate-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                No other profiles available. Create a new profile first.
              </p>
            } @else {
              <div class="space-y-2">
                @for (profile of availableProfiles(); track profile.id) {
                  <label
                    class="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-all"
                    [style.borderColor]="selectedProfileId === profile.id ? '#3b82f6' : '#e2e8f0'">
                    <input
                      type="radio"
                      name="targetProfile"
                      [value]="profile.id"
                      [(ngModel)]="selectedProfileId"
                      class="text-blue-600 focus:ring-blue-500"
                    />
                    <span class="font-medium text-slate-800">{{ profile.name }}</span>
                  </label>
                }
              </div>
            }
          </div>

          @if (availableProfiles().length > 0) {
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p class="text-xs text-amber-800">
                <strong>Note:</strong> This will move the card, all its statements, and installments to the selected profile.
              </p>
            </div>

            <button
              type="submit"
              [disabled]="!selectedProfileId"
              class="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors">
              Transfer Card
            </button>
          }
        </form>
      }
    </app-modal>
  `
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
