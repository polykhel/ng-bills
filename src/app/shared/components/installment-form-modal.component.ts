import { Component, computed, effect, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { format, subMonths } from 'date-fns';
import { Calculator, Calendar, LucideAngularModule } from 'lucide-angular';
import { AppStateService, CardService, InstallmentService } from '@services';
import { ModalComponent } from './modal.component';
import type { Installment } from '../types';

@Component({
  selector: 'app-installment-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, ModalComponent],
  templateUrl: './installment-form-modal.component.html',
})
export class InstallmentFormModalComponent implements OnInit {
  readonly Calendar = Calendar;
  readonly Calculator = Calculator;

  form!: FormGroup;
  editingInstallment = signal<Installment | null>(null);
  instMode = signal<'date' | 'term'>('date');

  selectedCard = computed(() => {
    const cardId = this.form?.value.cardId;
    return this.cardService.activeCards().find(c => c.id === cardId);
  });

  constructor(
    private fb: FormBuilder,
    private installmentService: InstallmentService,
    public cardService: CardService,
    public appState: AppStateService
  ) {
    effect(() => {
      const modalState = this.appState.modalState();
      if (modalState.type === 'installment-form') {
        const installmentId = modalState.data?.installmentId;
        if (installmentId) {
          const inst = this.installmentService.installments().find(i => i.id === installmentId);
          this.editingInstallment.set(inst || null);
          if (inst) {
            this.form.patchValue(inst);
          }
        } else {
          this.editingInstallment.set(null);
          this.form.reset({
            terms: 12,
            currentTerm: 1
          });
        }
      }
    });
  }

  get isOpen(): boolean {
    return this.appState.modalState().type === 'installment-form';
  }

  get formattedViewDate(): string {
    return format(this.appState.viewDate(), 'MMMM yyyy');
  }

  get calculatedStartDateDisplay(): string {
    const currentTerm = this.form.value.currentTerm || 1;
    const backDate = subMonths(this.appState.viewDate(), currentTerm - 1);
    return format(backDate, 'MMMM yyyy');
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      cardId: ['', [Validators.required]],
      totalPrincipal: [0, [Validators.required, Validators.min(0.01)]],
      terms: [12, [Validators.required, Validators.min(1)]],
      monthlyAmortization: [null],
      startDate: [''],
      currentTerm: [1, [Validators.min(1)]]
    });

    // Set default card if available
    const activeCards = this.cardService.activeCards();
    if (activeCards.length > 0 && !this.form.value.cardId) {
      this.form.patchValue({cardId: activeCards[0].id});
    }
  }

  setInstMode(mode: 'date' | 'term'): void {
    this.instMode.set(mode);
  }

  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.value;

      let calculatedStartDate = formValue.startDate;
      if (this.instMode() === 'term') {
        const currentTerm = formValue.currentTerm || 1;
        const backDate = subMonths(this.appState.viewDate(), currentTerm - 1);
        calculatedStartDate = format(backDate, 'yyyy-MM-dd');
      }

      const monthlyAmort = formValue.monthlyAmortization ||
        (formValue.totalPrincipal / formValue.terms);

      const installmentData: Partial<Installment> = {
        name: formValue.name,
        cardId: formValue.cardId,
        totalPrincipal: formValue.totalPrincipal,
        terms: formValue.terms,
        monthlyAmortization: monthlyAmort,
        startDate: calculatedStartDate
      };

      if (this.editingInstallment()) {
        const instId = this.editingInstallment()!.id;
        this.installmentService.updateInstallment(instId, installmentData);
      } else {
        this.installmentService.addInstallment(installmentData as Omit<Installment, 'id'>);
      }

      this.close();
    }
  }

  close(): void {
    this.form.reset({terms: 12, currentTerm: 1});
    this.editingInstallment.set(null);
    this.instMode.set('date');
    this.appState.closeModal();
  }
}
