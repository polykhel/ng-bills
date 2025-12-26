import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calendar-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-header.component.html',
})
export class CalendarHeaderComponent {
  @Input() days: string[] = [];
}
