import { Component, OnInit, signal, effect, computed } from '@angular/core';

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { format, subMonths } from 'date-fns';
import { LucideAngularModule, Calendar, Calculator } from 'lucide-angular';
import { InstallmentService, CardService, AppStateService, UtilsService } from '../../core/services';
import { ModalComponent } from './modal.component';
import type { Installment } from '../types';

@Component({
  selector: 'app-installment-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, LucideAngularModule, ModalComponent],
  template: `
    <app-modal 
      [isOpen]="isOpen" 
      [title]="editingInstallment() ? 'Edit Installment' : 'Add Installment'"
      (onClose)="close()">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Item/Purchase Name
          </label>
          <input
            formControlName="name"
            placeholder="e.g. New Laptop"
            class="w-full p-2 border rounded-lg text-sm"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Charge to Card
          </label>
          <select
            formControlName="cardId"
            class="w-full p-2 border rounded-lg text-sm bg-white">
            @for (card of cardService.activeCards(); track card.id) {
              <option [value]="card.id">
                {{ card.bankName }} - {{ card.cardName }}{{ card.isCashCard ? ' (Cash)' : '' }}
              </option>
            }
          </select>
          @if (selectedCard()?.isCashCard) {
            <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
              <p class="text-[11px] text-green-700 font-medium">
                💰 Cash Card: Each installment will appear as a separate line item with its own due date in the dashboard and calendar.
              </p>
            </div>
          }
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Principal Amount
            </label>
            <input
              type="number"
              step="0.01"
              formControlName="totalPrincipal"
              placeholder="0.00"
              class="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Terms (Months)
            </label>
            <input
              type="number"
              formControlName="terms"
              min="1"
              placeholder="12, 24, 36"
              class="w-full p-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Monthly Amortization (Optional Override)
          </label>
          <input
            type="number"
            step="any"
            formControlName="monthlyAmortization"
            placeholder="Leave blank to auto-calculate (Principal ÷ Terms)"
            class="w-full p-2 border rounded-lg text-sm"
          />
          <p class="text-[10px] text-slate-400 mt-1">
            Optional: Enter the exact monthly payment amount if it differs from simple division
            (e.g., includes interest or fees). Leave blank to auto-calculate.
          </p>
        </div>

        <div class="border-t pt-4 mt-4">
          <h4 class="text-sm font-semibold text-slate-700 mb-2">
            How to Determine Start Date?
          </h4>
          <div class="flex space-x-2 mb-4">
            <button
              type="button"
              (click)="setInstMode('date')"
              [class]="cn(
                'flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-sm transition-colors',
                instMode() === 'date'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )">
              <lucide-icon [img]="Calendar" class="w-4 h-4"></lucide-icon> Set Start Date
            </button>
            <button
              type="button"
              (click)="setInstMode('term')"
              [class]="cn(
                'flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-sm transition-colors',
                instMode() === 'term'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )">
              <lucide-icon [img]="Calculator" class="w-4 h-4"></lucide-icon> Set Current Term
            </button>
          </div>
        </div>

        @if (instMode() === 'date') {
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Start Date (First Payment Month)
            </label>
            <input
              type="date"
              formControlName="startDate"
              class="w-full p-2 border rounded-lg text-sm"
            />
          </div>
        }

        @if (instMode() === 'term') {
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">
              Current Term (Month # for {{ formattedViewDate }})
            </label>
            <input
              type="number"
              min="1"
              [max]="form.value.terms || 12"
              formControlName="currentTerm"
              placeholder="e.g. 12"
              class="w-full p-2 border rounded-lg text-sm"
            />
            @if (form.value.currentTerm > 0 && form.value.currentTerm <= (form.value.terms || 12)) {
              <p class="text-xs text-slate-500 mt-2 p-2 bg-blue-50 rounded-lg">
                <span class="font-medium">Calculated Start Date:</span>
                {{ calculatedStartDateDisplay }}
                <span class="text-slate-400"> (Term 1)</span>
              </p>
            }
          </div>
        }

        <button
          type="submit"
          [disabled]="form.invalid"
          class="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ editingInstallment() ? 'Update Installment' : 'Add Installment' }}
        </button>
      </form>
    </app-modal>
  `
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
    public appState: AppStateService,
    private utils: UtilsService
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
      this.form.patchValue({ cardId: activeCards[0].id });
    }
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

  cn(...inputs: any[]): string {
    return this.utils.cn(...inputs);
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
    this.form.reset({ terms: 12, currentTerm: 1 });
    this.editingInstallment.set(null);
    this.instMode.set('date');
    this.appState.closeModal();
  }
}
