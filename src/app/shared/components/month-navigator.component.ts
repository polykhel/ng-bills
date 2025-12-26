import { Component, Input, Output, EventEmitter } from '@angular/core';

import { format } from 'date-fns';
import { LucideAngularModule, ChevronLeft, ChevronRight } from 'lucide-angular';
import { AppStateService } from '../../core/services';

@Component({
  selector: 'app-month-navigator',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <div class="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
      <button
        (click)="appState.previousMonth()"
        class="p-1 hover:bg-white hover:shadow-sm rounded-md transition text-slate-500">
        <lucide-icon [img]="ChevronLeft" class="w-4 h-4"></lucide-icon>
      </button>
      <span class="text-sm font-semibold w-28 text-center text-slate-700 select-none">
        {{ formattedDate }}
      </span>
      <button
        (click)="appState.nextMonth()"
        class="p-1 hover:bg-white hover:shadow-sm rounded-md transition text-slate-500">
        <lucide-icon [img]="ChevronRight" class="w-4 h-4"></lucide-icon>
      </button>
    </div>
  `
})
export class MonthNavigatorComponent {
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  constructor(public appState: AppStateService) {}

  get formattedDate(): string {
    return format(this.appState.viewDate(), 'MMMM yyyy');
  }
}
