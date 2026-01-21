import { computed, effect, Injectable, signal } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import type { Profile } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private profilesSignal = signal<Profile[]>([]);
  // Public signals
  profiles = this.profilesSignal.asReadonly();
  private activeProfileIdSignal = signal<string>('');
  activeProfileId = this.activeProfileIdSignal.asReadonly();
  // Computed active profile
  activeProfile = computed(() => {
    const profiles = this.profilesSignal();
    const activeId = this.activeProfileIdSignal();
    return profiles.find((p) => p.id === activeId) || null;
  });
  private isLoadedSignal = signal<boolean>(false);
  isLoaded = this.isLoadedSignal.asReadonly();

  constructor(private idb: IndexedDBService) {
    void this.initializeProfiles();
    this.setupAutoSave();
  }

  addProfile(name: string): void {
    const newProfile: Profile = { id: this.generateId(), name };
    this.profilesSignal.update((profiles) => [...profiles, newProfile]);
    this.activeProfileIdSignal.set(newProfile.id);
  }

  renameProfile(profileId: string, newName: string): void {
    this.profilesSignal.update((profiles) =>
      profiles.map((p) => (p.id === profileId ? { ...p, name: newName } : p)),
    );
  }

  deleteProfile(profileId: string): boolean {
    const profiles = this.profilesSignal();
    if (profiles.length <= 1) {
      console.warn('Cannot delete the last profile');
      return false;
    }

    this.profilesSignal.update((profs) => profs.filter((p) => p.id !== profileId));

    // Switch to first remaining profile if active was deleted
    if (this.activeProfileIdSignal() === profileId) {
      const remaining = this.profilesSignal();
      this.activeProfileIdSignal.set(remaining[0].id);
    }

    return true;
  }

  setActiveProfile(profileId: string): void {
    const profile = this.profilesSignal().find((p) => p.id === profileId);
    if (profile) {
      this.activeProfileIdSignal.set(profileId);
    }
  }

  private async initializeProfiles(): Promise<void> {
    const db = this.idb.getDB();
    const loadedProfiles = await db.getAll<Profile>(STORES.PROFILES);
    let initialProfileId: string;

    if (loadedProfiles.length === 0) {
      const defaultProfile: Profile = { id: this.generateId(), name: 'My Profile' };
      this.profilesSignal.set([defaultProfile]);
      initialProfileId = defaultProfile.id;
      await db.putAll(STORES.PROFILES, [defaultProfile]);
    } else {
      // Try to restore last active profile
      const savedActive = await db.get<{ key: string; value: string }>(
        STORES.SETTINGS,
        'activeProfileId',
      );
      const activeId = savedActive?.value;
      const exists = activeId && loadedProfiles.some((p) => p.id === activeId);
      initialProfileId = exists ? activeId : loadedProfiles[0].id;
      this.profilesSignal.set(loadedProfiles);
    }

    this.activeProfileIdSignal.set(initialProfileId);
    this.isLoadedSignal.set(true);
  }

  private setupAutoSave(): void {
    // Auto-save profiles when they change
    effect(() => {
      if (this.isLoadedSignal()) {
        void this.idb.getDB().putAll(STORES.PROFILES, this.profilesSignal());
      }
    });

    // Auto-save active profile ID when it changes
    effect(() => {
      if (this.isLoadedSignal() && this.activeProfileIdSignal()) {
        void this.idb
          .getDB()
          .put(STORES.SETTINGS, { key: 'activeProfileId', value: this.activeProfileIdSignal() });
      }
    });
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
