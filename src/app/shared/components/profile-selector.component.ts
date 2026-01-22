import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckCircle2, LucideAngularModule, Pencil, User, UserPlus } from 'lucide-angular';
import { AppStateService, ProfileService } from '@services';

@Component({
  selector: 'app-profile-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './profile-selector.component.html',
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
  ) {
  }

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
