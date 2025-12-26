import { Injectable, signal, computed, effect } from '@angular/core';
import { StorageService } from './storage.service';
import type { Profile } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private profilesSignal = signal<Profile[]>([]);
  private activeProfileIdSignal = signal<string>('');
  private isLoadedSignal = signal<boolean>(false);

  // Public signals
  profiles = this.profilesSignal.asReadonly();
  activeProfileId = this.activeProfileIdSignal.asReadonly();
  isLoaded = this.isLoadedSignal.asReadonly();

  // Computed active profile
  activeProfile = computed(() => {
    const profiles = this.profilesSignal();
    const activeId = this.activeProfileIdSignal();
    return profiles.find(p => p.id === activeId) || null;
  });

  constructor(private storageService: StorageService) {
    this.initializeProfiles();
    this.setupAutoSave();
  }

  private initializeProfiles(): void {
    const loadedProfiles = this.storageService.getProfiles();
    let initialProfileId = '';

    if (loadedProfiles.length === 0) {
      const defaultProfile: Profile = { id: this.generateId(), name: 'My Profile' };
      this.profilesSignal.set([defaultProfile]);
      initialProfileId = defaultProfile.id;
      this.storageService.saveProfiles([defaultProfile]);
    } else {
      // Try to restore last active profile
      const savedActive = this.storageService.getActiveProfileId();
      const exists = savedActive && loadedProfiles.some(p => p.id === savedActive);
      initialProfileId = exists ? (savedActive as string) : loadedProfiles[0].id;
      this.profilesSignal.set(loadedProfiles);
    }

    this.activeProfileIdSignal.set(initialProfileId);
    this.isLoadedSignal.set(true);
  }

  private setupAutoSave(): void {
    // Auto-save profiles when they change
    effect(() => {
      if (this.isLoadedSignal()) {
        this.storageService.saveProfiles(this.profilesSignal());
      }
    });

    // Auto-save active profile ID when it changes
    effect(() => {
      if (this.isLoadedSignal() && this.activeProfileIdSignal()) {
        this.storageService.saveActiveProfileId(this.activeProfileIdSignal());
      }
    });
  }

  addProfile(name: string): void {
    const newProfile: Profile = { id: this.generateId(), name };
    this.profilesSignal.update(profiles => [...profiles, newProfile]);
    this.activeProfileIdSignal.set(newProfile.id);
  }

  renameProfile(profileId: string, newName: string): void {
    this.profilesSignal.update(profiles =>
      profiles.map(p => (p.id === profileId ? { ...p, name: newName } : p))
    );
  }

  deleteProfile(profileId: string): boolean {
    const profiles = this.profilesSignal();
    if (profiles.length <= 1) {
      console.warn('Cannot delete the last profile');
      return false;
    }

    this.profilesSignal.update(profs => profs.filter(p => p.id !== profileId));

    // Switch to first remaining profile if active was deleted
    if (this.activeProfileIdSignal() === profileId) {
      const remaining = this.profilesSignal();
      this.activeProfileIdSignal.set(remaining[0].id);
    }

    return true;
  }

  setActiveProfile(profileId: string): void {
    const profile = this.profilesSignal().find(p => p.id === profileId);
    if (profile) {
      this.activeProfileIdSignal.set(profileId);
    }
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
