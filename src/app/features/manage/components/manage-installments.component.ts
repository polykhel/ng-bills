import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule, Plus, Trash2, Pencil, List } from 'lucide-angular';
import type { Installment } from '../../../shared/types';
import { UtilsService } from '../../../core/services';

interface CardInfo {
  id: string;
  bankName: string;
  cardName: string;
}

@Component({
  selector: 'app-manage-installments',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <lucide-icon [img]="List" class="w-5 h-5"></lucide-icon>
          All Installments
        </h2>
        <button
          type="button"
          (click)="addInstallment.emit()"
          class="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
          <lucide-icon [img]="Plus" class="w-4 h-4"></lucide-icon>
          Add Installment
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase text-slate-600">
            <tr>
              <th class="px-3 py-2 text-left">
                <button type="button" class="font-bold hover:text-slate-900" (click)="sort.emit('name')">Item</button>
              </th>
              <th class="px-3 py-2 text-left">
                <button type="button" class="font-bold hover:text-slate-900" (click)="sort.emit('card')">Card</button>
              </th>
              <th class="px-3 py-2 text-left">
                <button type="button" class="font-bold hover:text-slate-900" (click)="sort.emit('startDate')">Start Date</button>
              </th>
              <th class="px-3 py-2 text-left">
                <button type="button" class="font-bold hover:text-slate-900" (click)="sort.emit('progress')">Progress</button>
              </th>
              <th class="px-3 py-2 text-left">Monthly</th>
              <th class="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr *ngFor="let inst of installments; trackBy: trackInst" class="text-slate-700">
              <td class="px-3 py-2 font-medium text-slate-800">{{ inst.name }}</td>
              <td class="px-3 py-2 text-slate-600">{{ cardLabel(inst.cardId) }}</td>
              <td class="px-3 py-2 text-slate-600">{{ formatDate(inst.startDate) }}</td>
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-mono w-14 text-right">{{ progressLabel(inst) }}</span>
                  <div *ngIf="isActive(inst)" class="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full" [style.width]="progressWidth(inst)"></div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2 font-semibold text-slate-800">₱{{ utils.formatCurrency(inst.monthlyAmortization) }}</td>
              <td class="px-3 py-2 text-right">
                <div class="flex justify-end gap-2">
                  <button type="button" (click)="editInstallment.emit(inst)" class="text-slate-400 hover:text-blue-500" title="Edit">
                    <lucide-icon [img]="Pencil" class="w-4 h-4"></lucide-icon>
                  </button>
                  <button type="button" (click)="deleteInstallment.emit(inst.id)" class="text-slate-400 hover:text-rose-500" title="Delete">
                    <lucide-icon [img]="Trash2" class="w-4 h-4"></lucide-icon>
                  </button>
                </div>
              </td>
            </tr>
            <tr *ngIf="installments.length === 0">
              <td colspan="6" class="px-3 py-4 text-center text-slate-400">No installments found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class ManageInstallmentsComponent {
  @Input() installments: Installment[] = [];
  @Input() cards: CardInfo[] = [];
  @Input() viewDate = new Date();

  @Output() sort = new EventEmitter<string>();
  @Output() addInstallment = new EventEmitter<void>();
  @Output() editInstallment = new EventEmitter<Installment>();
  @Output() deleteInstallment = new EventEmitter<string>();

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly List = List;

  constructor(public utils: UtilsService) {}

  cardLabel(cardId: string): string {
    const card = this.cards.find(c => c.id === cardId);
    return card ? `${card.bankName} - ${card.cardName}` : 'Unknown';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  }

  progressLabel(inst: Installment): string {
    const status = this.utils.getInstallmentStatus(inst, this.viewDate);
    if (status.currentTerm > inst.terms) return 'Done';
    if (status.currentTerm < 1) return 'Pending';
    return `${status.currentTerm}/${inst.terms}`;
  }

  isActive(inst: Installment): boolean {
    return this.utils.getInstallmentStatus(inst, this.viewDate).isActive;
  }

  progressWidth(inst: Installment): string {
    const status = this.utils.getInstallmentStatus(inst, this.viewDate);
    return `${(status.currentTerm / inst.terms) * 100}%`;
  }

  trackInst = (_: number, inst: Installment) => inst.id;
}
