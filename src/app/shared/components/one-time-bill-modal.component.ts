import { Component, OnInit, signal, effect } from '@angular/core';

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { OneTimeBillService, CardService, AppStateService } from '@services';
import { ModalComponent } from './modal.component';
import type { OneTimeBill } from '../types';

@Component({
  selector: 'app-one-time-bill-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  template: `
    <app-modal 
      [isOpen]="isOpen" 
      [title]="editingBill() ? 'Edit One-Time Bill' : 'Add One-Time Bill'"
      (onClose)="close()">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Card *
          </label>
          <select
            formControlName="cardId"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">Select a card</option>
            @for (card of cardService.activeCards(); track card.id) {
              <option [value]="card.id">
                {{ card.bankName }} - {{ card.cardName }}
              </option>
            }
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Bill Name *
          </label>
          <input
            type="text"
            formControlName="name"
            placeholder="e.g., Restaurant, Gas"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Amount *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            formControlName="amount"
            placeholder="0.00"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Due Date *
          </label>
          <input
            type="date"
            formControlName="dueDate"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div class="flex items-center">
          <input
            type="checkbox"
            id="isPaid"
            formControlName="isPaid"
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
          />
          <label for="isPaid" class="ml-2 block text-sm text-slate-700">
            Mark as Paid
          </label>
        </div>

        <div class="flex gap-3 justify-end pt-4">
          <button
            type="button"
            (click)="close()"
            class="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium">
            Cancel
          </button>
          <button
            type="submit"
            [disabled]="form.invalid"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {{ editingBill() ? 'Update' : 'Add' }} Bill
          </button>
        </div>
      </form>
    </app-modal>
  `
})
export class OneTimeBillModalComponent implements OnInit {
  form!: FormGroup;
  editingBill = signal<OneTimeBill | null>(null);

  constructor(
    private fb: FormBuilder,
    private oneTimeBillService: OneTimeBillService,
    public cardService: CardService,
    public appState: AppStateService
  ) {
    effect(() => {
      const modalState = this.appState.modalState();
      if (modalState.type === 'one-time-bill') {
        const billId = modalState.data?.billId;
        if (billId) {
          const bill = this.oneTimeBillService.oneTimeBills().find(b => b.id === billId);
          this.editingBill.set(bill || null);
          if (bill) {
            this.form.patchValue(bill);
          }
        } else {
          this.editingBill.set(null);
          this.form.reset({ isPaid: false });
        }
      }
    });
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      cardId: ['', [Validators.required]],
      name: ['', [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      dueDate: ['', [Validators.required]],
      isPaid: [false]
    });
  }

  get isOpen(): boolean {
    return this.appState.modalState().type === 'one-time-bill';
  }

  onSubmit(): void {
    if (this.form.valid) {
      const billData = this.form.value;
      
      if (this.editingBill()) {
        const billId = this.editingBill()!.id;
        this.oneTimeBillService.updateOneTimeBill(billId, billData);
      } else {
        this.oneTimeBillService.addOneTimeBill(billData);
      }

      this.close();
    }
  }

  close(): void {
    this.form.reset({ isPaid: false });
    this.editingBill.set(null);
    this.appState.closeModal();
  }
}
