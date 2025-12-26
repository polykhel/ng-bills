import { Component } from '@angular/core';

import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, CreditCard } from 'lucide-angular';
import { ProfileService, AppStateService } from './core/services';
import { 
  MonthNavigatorComponent, 
  ProfileSelectorComponent, 
  MultiProfileSelectorComponent,
  ProfileFormModalComponent,
  CardFormModalComponent,
  InstallmentFormModalComponent,
  OneTimeBillModalComponent,
  TransferCardModalComponent
} from './shared/components';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    MonthNavigatorComponent,
    ProfileSelectorComponent,
    MultiProfileSelectorComponent,
    ProfileFormModalComponent,
    CardFormModalComponent,
    InstallmentFormModalComponent,
    OneTimeBillModalComponent,
    TransferCardModalComponent
],
  templateUrl: './app.component.html',
  styles: [`
    .active-link {
      color: rgb(37, 99, 235);
      background: rgb(241, 245, 249);
      border-bottom: 2px solid rgb(37, 99, 235);
    }
  `],
})
export class AppComponent {
  readonly CreditCard = CreditCard;

  constructor(
    protected profileService: ProfileService,
    protected appState: AppStateService
  ) {}
}
