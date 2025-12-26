import { Component, effect, OnInit, signal } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStateService, CardService, ProfileService } from '@services';
import { ModalComponent } from './modal.component';
import type { CreditCard } from '../types';

@Component({
  selector: 'app-card-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './card-form-modal.component.html',
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
          this.form.reset({color: '#334155', isCashCard: false});
        }
      }
    });
  }

  get isOpen(): boolean {
    return this.appState.modalState().type === 'card-form';
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
    this.form.reset({color: '#334155', isCashCard: false});
    this.editingCard.set(null);
    this.appState.closeModal();
  }
}
