import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calendar-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-7 gap-2 mb-2">
      @for (day of days; track day) {
        <div class="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
          {{ day }}
        </div>
      }
    </div>
  `,
})
export class CalendarHeaderComponent {
  @Input() days: string[] = [];
}
