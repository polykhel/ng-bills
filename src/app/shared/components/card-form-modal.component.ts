import { Component, OnInit, signal, effect } from '@angular/core';

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CardService, ProfileService, AppStateService } from '@services';
import { ModalComponent } from './modal.component';
import type { CreditCard } from '../types';

@Component({
  selector: 'app-card-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  template: `
    <app-modal 
      [isOpen]="isOpen" 
      [title]="editingCard() ? 'Edit Card' : 'Add New Card'"
      (onClose)="close()">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Bank Name
            </label>
            <input
              formControlName="bankName"
              placeholder="e.g. BPI"
              class="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Card Name
            </label>
            <input
              formControlName="cardName"
              placeholder="e.g. Gold Rewards"
              class="w-full p-2 border rounded-lg text-sm"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Due Day (1-31)
            </label>
            <input
              type="number"
              formControlName="dueDay"
              placeholder="15"
              min="1"
              max="31"
              class="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Cut-off Day
            </label>
            <input
              type="number"
              formControlName="cutoffDay"
              placeholder="10"
              min="1"
              max="31"
              class="w-full p-2 border rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Color Identifier
          </label>
          <input
            type="color"
            formControlName="color"
            class="w-full h-10 p-1 border rounded-lg cursor-pointer"
          />
        </div>
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            id="isCashCard"
            formControlName="isCashCard"
            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <label for="isCashCard" class="text-sm font-medium text-slate-700 cursor-pointer">
            Cash Card (installments shown as separate line items with custom due dates)
          </label>
        </div>
        <button
          type="submit"
          [disabled]="form.invalid"
          class="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ editingCard() ? 'Update Card' : 'Save Card' }}
        </button>
      </form>
    </app-modal>
  `
})
export class CardFormModalComponent implements OnInit {
  form!: FormGroup;
  editingCard = signal<CreditCard | null>(null);

  constructor(
    private fb: FormBuilder,
    private cardService: CardService,
    private profileService: ProfileService,
    public appState: AppStateService
  ) {
    // Watch for modal state changes to populate form
    effect(() => {
      const modalState = this.appState.modalState();
      if (modalState.type === 'card-form') {
        const cardId = modalState.data?.cardId;
        if (cardId) {
          const card = this.cardService.cards().find(c => c.id === cardId);
          this.editingCard.set(card || null);
          if (card) {
            this.form.patchValue(card);
          }
        } else {
          this.editingCard.set(null);
          this.form.reset({ color: '#334155', isCashCard: false });
        }
      }
    });
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      bankName: ['', [Validators.required]],
      cardName: ['', [Validators.required]],
      dueDay: [15, [Validators.required, Validators.min(1), Validators.max(31)]],
      cutoffDay: [10, [Validators.required, Validators.min(1), Validators.max(31)]],
      color: ['#334155', [Validators.required]],
      isCashCard: [false]
    });
  }

  get isOpen(): boolean {
    return this.appState.modalState().type === 'card-form';
  }

  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.value;
      const activeProfileId = this.profileService.activeProfileId();
      
      const cardData: Partial<CreditCard> & { id?: string } = {
        ...formValue,
        profileId: activeProfileId
      };

      if (this.editingCard()) {
        const cardId = this.editingCard()!.id;
        this.cardService.updateCard(cardId, cardData);
      } else {
        this.cardService.addCard(cardData as Omit<CreditCard, 'id'>);
      }

      this.close();
    }
  }

  close(): void {
    this.form.reset({ color: '#334155', isCashCard: false });
    this.editingCard.set(null);
    this.appState.closeModal();
  }
}
