import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, User, UserPlus, CheckCircle2, Pencil } from 'lucide-angular';
import { ProfileService, AppStateService } from '@services';

@Component({
  selector: 'app-profile-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="relative group">
      <button class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition">
        <div class="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center">
          <lucide-icon [img]="User" class="w-4 h-4"></lucide-icon>
        </div>
        <div class="text-left hidden md:block">
          <p class="text-xs text-slate-500 font-medium">Profile</p>
          <p class="text-sm font-bold leading-none text-slate-800">{{ profileService.activeProfile()?.name }}</p>
        </div>
      </button>
      <div class="absolute right-0 top-full pt-2 w-48 hidden group-hover:block z-50">
        <div class="bg-white rounded-xl shadow-xl border border-slate-100 p-1 animate-in fade-in zoom-in-95 duration-100">
          @for (profile of profileService.profiles(); track profile.id) {
            <div class="mb-1">
              @if (editingProfileId() === profile.id) {
                <form
                  (submit)="saveRename($event)"
                  class="flex items-center gap-1 px-2 py-1">
                  <input
                    type="text"
                    [(ngModel)]="editingName"
                    name="profileName"
                    (blur)="cancelEdit()"
                    #nameInput
                    class="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </form>
              } @else {
                <div class="flex items-center gap-1">
                  <button
                    (click)="selectProfile(profile.id)"
                    class="flex-1 text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between"
                    [ngClass]="profileService.activeProfileId() === profile.id ? ['bg-blue-50','text-blue-700'] : ['hover:bg-slate-50','text-slate-700']">
                    {{ profile.name }}
                    @if (profileService.activeProfileId() === profile.id) {
                      <lucide-icon [img]="CheckCircle2" class="w-3 h-3"></lucide-icon>
                    }
                  </button>
                  <button
                    (click)="startEdit($event, profile.id, profile.name)"
                    class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                    title="Rename profile">
                    <lucide-icon [img]="Pencil" class="w-3 h-3"></lucide-icon>
                  </button>
                </div>
              }
            </div>
          }
          <div class="h-px bg-slate-100 my-1"></div>
          <button
            (click)="createProfile()"
            class="w-full text-left px-3 py-2 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg flex items-center gap-2">
            <lucide-icon [img]="UserPlus" class="w-3 h-3"></lucide-icon> Create Profile
          </button>
        </div>
      </div>
    </div>
  `
})
export class ProfileSelectorComponent {
  readonly User = User;
  readonly UserPlus = UserPlus;
  readonly CheckCircle2 = CheckCircle2;
  readonly Pencil = Pencil;

  editingProfileId = signal<string | null>(null);
  editingName = '';

  constructor(
    public profileService: ProfileService,
    private appState: AppStateService
  ) {}

  selectProfile(profileId: string): void {
    this.profileService.setActiveProfile(profileId);
  }

  createProfile(): void {
    this.appState.openProfileForm();
  }

  startEdit(event: Event, profileId: string, name: string): void {
    event.stopPropagation();
    this.editingProfileId.set(profileId);
    this.editingName = name;
  }

  saveRename(event: Event): void {
    event.preventDefault();
    if (this.editingName.trim() && this.editingProfileId()) {
      this.profileService.renameProfile(this.editingProfileId()!, this.editingName.trim());
      this.cancelEdit();
    }
  }

  cancelEdit(): void {
    this.editingProfileId.set(null);
    this.editingName = '';
  }
}
