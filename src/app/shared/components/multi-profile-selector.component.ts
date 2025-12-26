import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Users, CheckCircle2, Circle } from 'lucide-angular';
import { ProfileService, AppStateService } from '../../core/services';

@Component({
  selector: 'app-multi-profile-selector',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="relative group">
      <button 
        (click)="toggleMode()"
        class="flex items-center gap-2 p-1.5 rounded-lg transition"
        [ngClass]="appState.multiProfileMode() ? 'bg-blue-100' : 'hover:bg-slate-100'"
        [title]="appState.multiProfileMode() ? 'Multi-profile mode active' : 'Enable multi-profile view'">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white" [ngClass]="appState.multiProfileMode() ? 'bg-blue-600' : 'bg-slate-800'">
          <lucide-icon [img]="Users" class="w-4 h-4"></lucide-icon>
        </div>
        <div class="text-left hidden md:block">
          <p class="text-xs text-slate-500 font-medium">View Mode</p>
          <p class="text-sm font-bold leading-none text-slate-800">
            {{ appState.multiProfileMode() ? selectedCount + ' Profile' + (selectedCount !== 1 ? 's' : '') : 'Single' }}
          </p>
        </div>
      </button>
      
      @if (appState.multiProfileMode()) {
        <div class="absolute right-0 top-full pt-2 w-64 hidden group-hover:block z-50">
          <div class="bg-white rounded-xl shadow-xl border border-slate-100 p-3 animate-in fade-in zoom-in-95 duration-100">
            <div class="mb-2 pb-2 border-b border-slate-200">
              <p class="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Select Profiles to View
              </p>
              <p class="text-[10px] text-slate-500 mt-0.5">
                Toggle profiles to combine in view
              </p>
            </div>
            <div class="space-y-1 max-h-64 overflow-y-auto">
              @for (profile of profileService.profiles(); track profile.id) {
                <button
                  (click)="toggleProfile(profile.id)"
                  class="w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors"
                  [ngClass]="isSelected(profile.id) ? ['bg-blue-50','text-blue-700','hover:bg-blue-100'] : ['hover:bg-slate-50','text-slate-700']">
                  <span class="font-medium">{{ profile.name }}</span>
                  @if (isSelected(profile.id)) {
                    <lucide-icon [img]="CheckCircle2" class="w-4 h-4 text-blue-600"></lucide-icon>
                  } @else {
                    <lucide-icon [img]="Circle" class="w-4 h-4 text-slate-300"></lucide-icon>
                  }
                </button>
              }
            </div>
            <div class="mt-2 pt-2 border-t border-slate-200">
              <button
                (click)="toggleMode()"
                class="w-full text-center px-3 py-2 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors font-medium">
                Exit Multi-Profile Mode
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class MultiProfileSelectorComponent {
  readonly Users = Users;
  readonly CheckCircle2 = CheckCircle2;
  readonly Circle = Circle;

  constructor(
    public profileService: ProfileService,
    public appState: AppStateService
  ) {}

  get selectedCount(): number {
    return this.appState.selectedProfileIds().length;
  }

  

  toggleMode(): void {
    this.appState.toggleMultiProfileMode();
  }

  toggleProfile(profileId: string): void {
    this.appState.toggleProfileSelection(profileId);
  }

  isSelected(profileId: string): boolean {
    return this.appState.selectedProfileIds().includes(profileId);
  }
}
