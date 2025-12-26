import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule, Plus, Trash2, Pencil, DollarSign } from 'lucide-angular';
import type { OneTimeBill } from '../../../shared/types';
import { UtilsService } from '../../../core/services';

interface CardInfo {
  id: string;
  bankName: string;
  cardName: string;
}

@Component({
  selector: 'app-manage-one-time-bills',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <lucide-icon [img]="DollarSign" class="w-5 h-5"></lucide-icon>
          One-Time Bills
        </h2>
        <button
          type="button"
          (click)="addBill.emit()"
          class="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
          <lucide-icon [img]="Plus" class="w-4 h-4"></lucide-icon>
          Add One-Time Bill
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
                <button type="button" class="font-bold hover:text-slate-900" (click)="sort.emit('dueDate')">Due Date</button>
              </th>
              <th class="px-3 py-2 text-left">
                <button type="button" class="font-bold hover:text-slate-900" (click)="sort.emit('amount')">Amount</button>
              </th>
              <th class="px-3 py-2 text-left">
                <button type="button" class="font-bold hover:text-slate-900" (click)="sort.emit('isPaid')">Status</button>
              </th>
              <th class="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr *ngFor="let bill of bills; trackBy: trackBill" class="text-slate-700">
              <td class="px-3 py-2 font-medium text-slate-800">{{ bill.name }}</td>
              <td class="px-3 py-2 text-slate-600">{{ cardLabel(bill.cardId) }}</td>
              <td class="px-3 py-2 text-slate-600">{{ formatDate(bill.dueDate) }}</td>
              <td class="px-3 py-2 font-semibold text-slate-800">₱{{ utils.formatCurrency(bill.amount) }}</td>
              <td class="px-3 py-2">
                <span
                  [class]="bill.isPaid ? 'inline-block px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700' : 'inline-block px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700'">
                  {{ bill.isPaid ? 'Paid' : 'Pending' }}
                </span>
              </td>
              <td class="px-3 py-2 text-right">
                <div class="flex justify-end gap-2">
                  <button type="button" (click)="editBill.emit(bill)" class="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition" title="Edit">
                    <lucide-icon [img]="Pencil" class="w-4 h-4"></lucide-icon>
                  </button>
                  <button type="button" (click)="deleteBill.emit(bill.id)" class="p-1.5 hover:bg-red-100 rounded text-red-600 transition" title="Delete">
                    <lucide-icon [img]="Trash2" class="w-4 h-4"></lucide-icon>
                  </button>
                </div>
              </td>
            </tr>
            <tr *ngIf="bills.length === 0">
              <td colspan="6" class="px-3 py-4 text-center text-slate-400">No one-time bills found. Add one to get started.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class ManageOneTimeBillsComponent {
  @Input() bills: OneTimeBill[] = [];
  @Input() cards: CardInfo[] = [];
  @Input() viewDate = new Date();

  @Output() sort = new EventEmitter<string>();
  @Output() addBill = new EventEmitter<void>();
  @Output() editBill = new EventEmitter<OneTimeBill>();
  @Output() deleteBill = new EventEmitter<string>();

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly DollarSign = DollarSign;

  constructor(public utils: UtilsService) {}

  cardLabel(cardId: string): string {
    const card = this.cards.find(c => c.id === cardId);
    return card ? `${card.bankName} - ${card.cardName}` : 'Unknown';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  }

  trackBill = (_: number, bill: OneTimeBill) => bill.id;
}
