import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule, Plus, Pencil, ArrowRightLeft, Trash2, CreditCard as RawCardIcon } from 'lucide-angular';
import type { CreditCard } from '../../../shared/types';

const CardIcon = RawCardIcon;

@Component({
  selector: 'app-manage-cards',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-4">
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <lucide-icon [img]="CardIcon" class="w-5 h-5"></lucide-icon>
            Cards {{ multiProfileMode ? '(Multi-Profile)' : profileName ? '(' + profileName + ')' : '' }}
          </h2>
          <div class="flex gap-2 text-xs text-slate-500">
            <button
              type="button"
              (click)="changeSort.emit('bankName')"
              class="hover:text-blue-600"
              [class.text-blue-600]="currentSort.key === 'bankName'"
              [class.font-bold]="currentSort.key === 'bankName'">
              Name
            </button>
            <button
              type="button"
              (click)="changeSort.emit('dueDay')"
              class="hover:text-blue-600"
              [class.text-blue-600]="currentSort.key === 'dueDay'"
              [class.font-bold]="currentSort.key === 'dueDay'">
              Due Day
            </button>
          </div>
        </div>
        <button
          type="button"
          (click)="addCard.emit()"
          class="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition">
          <lucide-icon [img]="Plus" class="w-4 h-4"></lucide-icon>
          Add Card
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          *ngFor="let card of cards; trackBy: trackCard"
          class="relative group bg-slate-50 rounded-xl p-5 border border-slate-200 hover:border-slate-300 transition-all">
          <div class="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition">
            <button type="button" (click)="editCard.emit(card)" class="text-slate-400 hover:text-blue-500" title="Edit Card">
              <lucide-icon [img]="Pencil" class="w-4 h-4"></lucide-icon>
            </button>
            <button type="button" (click)="transferCard.emit(card)" class="text-slate-400 hover:text-purple-500" title="Transfer to Another Profile">
              <lucide-icon [img]="ArrowRightLeft" class="w-4 h-4"></lucide-icon>
            </button>
            <button type="button" (click)="deleteCard.emit(card.id)" class="text-slate-400 hover:text-rose-500" title="Delete Card">
              <lucide-icon [img]="Trash2" class="w-4 h-4"></lucide-icon>
            </button>
          </div>
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-8 rounded-md shadow-sm" [style.backgroundColor]="card.color || '#334155'"></div>
            <div>
              <h3 class="font-bold text-slate-800">{{ card.bankName }}</h3>
              <p class="text-xs text-slate-500">{{ card.cardName }}</p>
            </div>
          </div>
          <div class="flex justify-between text-sm text-slate-600 border-t border-slate-200 pt-3">
            <div class="flex flex-col">
              <span class="text-[10px] text-slate-400 uppercase tracking-wider">Due Day</span>
              <span class="font-semibold">{{ card.dueDay }}th</span>
            </div>
            <div class="flex flex-col text-right">
              <span class="text-[10px] text-slate-400 uppercase tracking-wider">Cut-off</span>
              <span class="font-semibold">{{ card.cutoffDay }}th</span>
            </div>
          </div>
        </div>
        <p *ngIf="cards.length === 0" class="col-span-3 text-center text-slate-400 py-4">
          {{ multiProfileMode ? 'No cards found. Select profiles to view.' : 'No cards found for this profile.' }}
        </p>
      </div>
    </div>
  `
})
export class ManageCardsComponent {
  @Input() cards: CreditCard[] = [];
  @Input() multiProfileMode = false;
  @Input() profileName = '';
  @Input() currentSort: { key: string; direction: string } = { key: 'bankName', direction: 'asc' };

  @Output() addCard = new EventEmitter<void>();
  @Output() editCard = new EventEmitter<CreditCard>();
  @Output() transferCard = new EventEmitter<CreditCard>();
  @Output() deleteCard = new EventEmitter<string>();
  @Output() changeSort = new EventEmitter<string>();

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly ArrowRightLeft = ArrowRightLeft;
  readonly Trash2 = Trash2;
  readonly CardIcon = CardIcon;

  constructor() {}

  trackCard = (_: number, card: CreditCard) => card.id;
}
