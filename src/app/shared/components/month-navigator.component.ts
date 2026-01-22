import { ChangeDetectionStrategy, Component } from '@angular/core';

import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, LucideAngularModule } from 'lucide-angular';
import { AppStateService } from '@services';

@Component({
  selector: 'app-month-navigator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './month-navigator.component.html',
})
export class MonthNavigatorComponent {
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;

  constructor(public appState: AppStateService) {
  }

  get formattedDate(): string {
    return format(this.appState.viewDate(), 'MMMM yyyy');
  }
}
