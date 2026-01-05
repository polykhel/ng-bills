import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertCircle, Cloud, Download, FileDown, Lock, LucideAngularModule, Upload } from 'lucide-angular';
import { SyncService, SyncUtilsService, GoogleDriveSyncService } from '@services';

@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './sync.component.html',
})
export class SyncComponent implements OnInit, OnDestroy {
  manualPassword = '';
  manualEncrypted = true;
  drivePassword = '';
  driveEncrypted = true;
  useAppDataFolder = true;
  isProcessing = false;
  message = '';
  isError = false;
  dataSize = 0;
  driveMessage = '';
  driveError = false;
  isDriveProcessing = false;
  statusMessage = '';
  driveStatusMessage = '';
  showReloadButton = false;
  showManualReloadButton = false;
  autoSyncEnabled = false;
  autoSyncInterval = 5; // minutes
  lastAutoSyncTime: Date | null = null;
  nextAutoSyncTime: Date | null = null;
  private autoSyncIntervalId: any = null;
  readonly MIN_AUTO_SYNC_INTERVAL = 1; // minimum 1 minute
  readonly MAX_AUTO_SYNC_INTERVAL = 60; // maximum 60 minutes

  driveStatus: any;

  readonly Download = Download;
  readonly Upload = Upload;
  readonly Cloud = Cloud;
  readonly FileDown = FileDown;
  readonly Lock = Lock;
  readonly AlertCircle = AlertCircle;

  constructor(
    private syncService: SyncService,
    private syncUtils: SyncUtilsService,
    private driveSync: GoogleDriveSyncService,
  ) {
    this.driveStatus = this.driveSync.syncStatus;
  }

  get manualPasswordStrength(): 'weak' | 'medium' | 'strong' {
    return this.syncUtils.getPasswordStrength(this.manualPassword || '');
  }

  get manualStrengthWidth(): string {
    if (this.manualPasswordStrength === 'weak') return '33%';
    if (this.manualPasswordStrength === 'medium') return '66%';
    return '100%';
  }

  get drivePasswordStrength(): 'weak' | 'medium' | 'strong' {
    return this.syncUtils.getPasswordStrength(this.drivePassword || '');
  }

  get driveStrengthWidth(): string {
    if (this.drivePasswordStrength === 'weak') return '33%';
    if (this.drivePasswordStrength === 'medium') return '66%';
    return '100%';
  }

  get passwordStrength(): 'weak' | 'medium' | 'strong' {
    return this.manualPasswordStrength;
  }

  get strengthWidth(): string {
    return this.manualStrengthWidth;
  }

  get isRestoreDisabled(): boolean {
    return this.driveEncrypted && !this.drivePassword;
  }

  get formattedDataSize(): string {
    return this.syncUtils.formatBytes(this.dataSize);
  }

  ngOnInit(): void {
    this.dataSize = this.syncUtils.getDataSize();
    this.initializeDrive();
    this.setupAutoSync();
    this.setupPageCloseSync();
  }

  ngOnDestroy(): void {
    this.clearAutoSyncInterval();
  }

  async onUseAppDataFolderChange(): Promise<void> {
    // Reinitialize Drive with the new setting
    await this.initializeDrive();
  }

  onAutoSyncEnabledChange(): void {
    if (this.autoSyncEnabled) {
      this.setupAutoSync();
    } else {
      this.clearAutoSyncInterval();
      this.nextAutoSyncTime = null;
    }
  }

  onAutoSyncIntervalChange(): void {
    // Clamp interval between min and max
    this.autoSyncInterval = Math.max(
      this.MIN_AUTO_SYNC_INTERVAL,
      Math.min(this.MAX_AUTO_SYNC_INTERVAL, this.autoSyncInterval)
    );
    // Reset the interval with new duration if auto-sync is enabled
    if (this.autoSyncEnabled) {
      this.clearAutoSyncInterval();
      this.setupAutoSync();
    }
  }

  async handleExport(): Promise<void> {
    if (this.manualEncrypted && !this.manualPassword) {
      this.showMessage('Please enter a password for encryption', true);
      return;
    }

    this.isProcessing = true;
    this.statusMessage = 'Exporting data...';
    this.showMessage('');

    try {
      await this.syncService.downloadBackup(this.manualEncrypted, this.manualPassword || undefined);
      this.statusMessage = '';
      this.isProcessing = false;
      this.showMessage('✓ Backup downloaded successfully!', false);
    } catch (error: any) {
      this.statusMessage = '';
      this.isProcessing = false;
      this.showMessage(`✗ Export failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  async handleImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.manualEncrypted && !this.manualPassword) {
      this.showMessage('Please enter a password to decrypt', true);
      input.value = '';
      return;
    }

    this.isProcessing = true;
    this.statusMessage = 'Importing data...';
    this.showMessage('');

    try {
      await this.syncService.loadBackup(file, this.manualEncrypted ? this.manualPassword : undefined);
      this.statusMessage = '';
      this.isProcessing = false;
      this.showMessage('✓ Data imported successfully! Reloading...', false);
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      this.statusMessage = '';
      this.isProcessing = false;
      this.showMessage(`✗ Import failed: ${error?.message || 'Unknown error'}`, true);
    } finally {
      input.value = '';
    }
  }

  private showMessage(msg: string, isError = false): void {
    this.message = msg;
    this.isError = isError;
  }

  private showDriveMessage(msg: string, isError = false): void {
    this.driveMessage = msg;
    this.driveError = isError;
  }

  private clearAutoSyncInterval(): void {
    if (this.autoSyncIntervalId) {
      clearInterval(this.autoSyncIntervalId);
      this.autoSyncIntervalId = null;
    }
  }

  private setupAutoSync(): void {
    if (!this.autoSyncEnabled) return;

    this.clearAutoSyncInterval();
    this.updateNextSyncTime();

    // Set up interval for auto-sync
    this.autoSyncIntervalId = setInterval(() => {
      this.performAutoSync();
    }, this.autoSyncInterval * 60 * 1000);

    // Perform initial sync immediately
    this.performAutoSync();
  }

  private setupPageCloseSync(): void {
    window.addEventListener('beforeunload', () => {
      if (this.autoSyncEnabled && this.driveStatus().isSignedIn) {
        this.performAutoSync();
      }
    });
  }

  private async performAutoSync(): Promise<void> {
    // Only sync if signed in and enabled
    if (!this.autoSyncEnabled || !this.driveStatus().isSignedIn) {
      return;
    }

    // Skip if encryption is enabled but no password
    if (this.driveEncrypted && !this.drivePassword) {
      return;
    }

    try {
      let content: string;
      if (this.driveEncrypted) {
        content = await this.syncService.exportEncrypted(this.drivePassword);
      } else {
        content = this.syncService.exportData();
      }
      await this.driveSync.uploadBackup(content, true);
      this.lastAutoSyncTime = new Date();
      this.updateNextSyncTime();
    } catch (error) {
      // Silently fail auto-sync to avoid interrupting user experience
      console.error('Auto-sync failed:', error);
    }
  }

  private updateNextSyncTime(): void {
    const nextTime = new Date();
    nextTime.setMinutes(nextTime.getMinutes() + this.autoSyncInterval);
    this.nextAutoSyncTime = nextTime;
  }

  get autoSyncStatusText(): string {
    if (!this.autoSyncEnabled) {
      return 'Auto-sync disabled';
    }
    if (this.lastAutoSyncTime) {
      return `Last auto-sync: ${this.lastAutoSyncTime.toLocaleTimeString()}`;
    }
    return 'Auto-sync enabled, pending first sync...';
  }

  reloadPage(): void {
    window.location.reload();
  }

  private async initializeDrive(): Promise<void> {
    try {
      const clientId = (await import('../../../environments/google-drive')).googleDriveConfig.clientId;
      if (!clientId) {
        this.showDriveMessage('Google Drive not configured', true);
        return;
      }
      await this.driveSync.initialize({
        clientId,
        useAppDataFolder: this.useAppDataFolder,
      });
      this.showDriveMessage('Google Drive ready');
    } catch (error: any) {
      this.showDriveMessage(`Drive init failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  async handleDriveSignIn(): Promise<void> {
    this.isDriveProcessing = true;
    this.driveStatusMessage = 'Signing in...';
    this.showDriveMessage('');
    try {
      await this.initializeDrive(); // Ensure correct config before sign in
      await this.driveSync.signIn();
      this.driveStatusMessage = '';
      this.isDriveProcessing = false;
      this.showDriveMessage('✓ Signed in to Google Drive');
    } catch (error: any) {
      this.driveStatusMessage = '';
      this.isDriveProcessing = false;
      this.showDriveMessage(`✗ Sign-in failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  handleDriveSignOut(): void {
    this.driveSync.signOut();
    this.showDriveMessage('Signed out of Google Drive');
  }

  async handleDriveUpload(): Promise<void> {
    if (this.driveEncrypted && !this.drivePassword) {
      this.showDriveMessage('Please enter a password for encryption', true);
      return;
    }

    this.isDriveProcessing = true;
    this.driveStatusMessage = 'Syncing to Drive...';
    this.showDriveMessage('');

    try {
      let content: string;
      if (this.driveEncrypted) {
        content = await this.syncService.exportEncrypted(this.drivePassword);
      } else {
        content = this.syncService.exportData();
      }
      await this.driveSync.uploadBackup(content, true);
      this.driveStatusMessage = '';
      this.isDriveProcessing = false;
      this.showDriveMessage('✓ Backup synced to Google Drive');
    } catch (error: any) {
      this.driveStatusMessage = '';
      this.isDriveProcessing = false;
      this.showDriveMessage(`✗ Drive sync failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  async handleDriveRestore(): Promise<void> {
    if (this.driveEncrypted && !this.drivePassword) {
      this.showDriveMessage('Please enter a password to decrypt', true);
      return;
    }

    this.isDriveProcessing = true;
    this.driveStatusMessage = 'Restoring from Drive...';
    this.showDriveMessage('');
    try {
      const content = await this.driveSync.downloadBackup();
      await this.syncService.importData(content, this.driveEncrypted ? this.drivePassword : undefined);
      this.driveStatusMessage = '';
      this.isDriveProcessing = false;
      this.showDriveMessage('✓ Data restored from Google Drive! Reloading...');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      this.driveStatusMessage = '';
      this.isDriveProcessing = false;
      this.showDriveMessage(`✗ Restore failed: ${error?.message || 'Unknown error'}`, true);
    }
  }
}
