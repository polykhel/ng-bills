import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CheckCircle2, Circle, LucideAngularModule, Users } from 'lucide-angular';
import { AppStateService, ProfileService } from '@services';

@Component({
  selector: 'app-multi-profile-selector',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './multi-profile-selector.component.html',
})
export class MultiProfileSelectorComponent {
  readonly Users = Users;
  readonly CheckCircle2 = CheckCircle2;
  readonly Circle = Circle;

  constructor(
    public profileService: ProfileService,
    public appState: AppStateService
  ) {
  }

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
