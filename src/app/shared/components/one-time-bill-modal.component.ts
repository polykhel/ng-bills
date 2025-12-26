import { Component, effect, OnInit, signal } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStateService, CardService, OneTimeBillService } from '@services';
import { ModalComponent } from './modal.component';
import type { OneTimeBill } from '../types';

@Component({
  selector: 'app-one-time-bill-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './one-time-bill-modal.component.html',
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
          this.form.reset({isPaid: false});
        }
      }
    });
  }

  get isOpen(): boolean {
    return this.appState.modalState().type === 'one-time-bill';
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
    this.form.reset({isPaid: false});
    this.editingBill.set(null);
    this.appState.closeModal();
  }
}
