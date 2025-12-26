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
  template: `
    <div class="min-h-screen bg-slate-50">
      <!-- Header -->
      <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-4 py-3 sm:h-16 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <div class="bg-blue-600 text-white p-1.5 rounded-lg">
              <lucide-icon [img]="CreditCard" class="w-5 h-5"></lucide-icon>
            </div>
            <h1 class="font-bold text-xl tracking-tight text-slate-900 hidden sm:block">
              BillTracker
            </h1>
          </div>

          <div class="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <app-month-navigator></app-month-navigator>
            @if (!appState.multiProfileMode()) {
              <app-profile-selector></app-profile-selector>
            }
            <app-multi-profile-selector></app-multi-profile-selector>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="max-w-7xl mx-auto px-4 border-t border-slate-100">
          <nav class="flex gap-1">
            <a 
              routerLink="/dashboard" 
              routerLinkActive="active-link"
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg transition-colors">
              Dashboard
            </a>
            <a 
              routerLink="/calendar" 
              routerLinkActive="active-link"
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg transition-colors">
              Calendar
            </a>
            <a 
              routerLink="/manage" 
              routerLinkActive="active-link"
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg transition-colors">
              Manage
            </a>
            <a 
              routerLink="/sync" 
              routerLinkActive="active-link"
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-t-lg transition-colors">
              Sync
            </a>
          </nav>
        </div>
      </header>

      <!-- Main Content -->
      <main class="max-w-7xl mx-auto p-4">
        <router-outlet></router-outlet>

      <!-- Modals -->
      <app-profile-form-modal></app-profile-form-modal>
      </main>

      <!-- Modals -->
      <app-profile-form-modal></app-profile-form-modal>
      <app-card-form-modal></app-card-form-modal>
      <app-installment-form-modal></app-installment-form-modal>
      <app-one-time-bill-modal></app-one-time-bill-modal>
      <app-transfer-card-modal></app-transfer-card-modal>
    </div>
  `,
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
