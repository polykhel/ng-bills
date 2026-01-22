import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ManageCardsComponent } from './components/manage-cards.component';
import { ManageCategoriesComponent } from './components/manage-categories.component';
import { AppStateService, ProfileService } from '@services';

@Component({
  selector: 'app-manage',
  standalone: true,
  imports: [CommonModule, ManageCardsComponent, ManageCategoriesComponent],
  templateUrl: './manage.component.html',
})
export class ManageComponent {
  private appState = inject(AppStateService);
  private profileService = inject(ProfileService);

  protected activeProfileName = computed(() => {
    const profiles = this.profileService.profiles();
    const activeId = this.profileService.activeProfileId();
    return profiles.find((p) => p.id === activeId)?.name || '';
  });

  protected multiProfileMode = this.appState.multiProfileMode;
}
