import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageFactory } from '@app/core/storage';
import type { StorageType } from '@app/core/storage';

@Component({
  selector: 'app-storage-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './storage-settings.component.html',
  styleUrls: ['./storage-settings.component.css'],
  providers: [StorageFactory]
})
export class StorageSettingsComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  storageStats: {
    type: StorageType;
    info: { used: number; available: number; percentage: number } | null;
    providerName: string;
  } | null = null;

  migrationInfo: any = null;
  migrating = false;
  errorMessage = '';
  successMessage = '';

  constructor(private storageFactory: StorageFactory) {}

  async ngOnInit(): Promise<void> {
    await this.loadStorageStats();
    this.migrationInfo = this.storageFactory.getMigrationInfo();
  }

  async loadStorageStats(): Promise<void> {
    try {
      this.storageStats = await this.storageFactory.getStorageStats();
    } catch (error) {
      console.error('Error loading storage stats:', error);
      this.errorMessage = 'Failed to load storage statistics';
    }
  }

  async migrateToIndexedDB(): Promise<void> {
    this.migrating = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.storageFactory.migrateToIndexedDB();
      this.successMessage = 'Migration completed successfully!';
      this.migrationInfo = this.storageFactory.getMigrationInfo();
      await this.loadStorageStats();
    } catch (error) {
      console.error('Migration failed:', error);
      this.errorMessage = `Migration failed: ${error}`;
    } finally {
      this.migrating = false;
    }
  }

  async forceMigration(): Promise<void> {
    if (!confirm('Are you sure you want to re-run the migration? This will overwrite existing IndexedDB data.')) {
      return;
    }

    this.migrating = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.storageFactory.forceMigration();
      this.successMessage = 'Re-migration completed successfully!';
      this.migrationInfo = this.storageFactory.getMigrationInfo();
      await this.loadStorageStats();
    } catch (error) {
      console.error('Re-migration failed:', error);
      this.errorMessage = `Re-migration failed: ${error}`;
    } finally {
      this.migrating = false;
    }
  }

  async exportData(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const jsonData = await this.storageFactory.exportCurrentData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ng-bills-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.successMessage = 'Data exported successfully!';
    } catch (error) {
      console.error('Export failed:', error);
      this.errorMessage = `Export failed: ${error}`;
    }
  }

  importData(): void {
    this.fileInput.nativeElement.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    const file = input.files[0];
    try {
      const text = await file.text();
      const provider = await this.storageFactory.getProvider();
      await provider.importData(text);
      this.successMessage = 'Data imported successfully! Please reload the page.';
    } catch (error) {
      console.error('Import failed:', error);
      this.errorMessage = `Import failed: ${error}`;
    }

    // Reset file input
    input.value = '';
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
