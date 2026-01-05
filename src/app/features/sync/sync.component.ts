import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertCircle, Cloud, Download, FileDown, Lock, LucideAngularModule, Upload } from 'lucide-angular';
import { SyncService, SyncUtilsService, GoogleDriveSyncService } from '@services';

@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './sync.component.html',
})
export class SyncComponent implements OnInit {
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
  }

  async onUseAppDataFolderChange(): Promise<void> {
    // Reinitialize Drive with the new setting
    await this.initializeDrive();
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
      this.showMessage('✓ Backup downloaded successfully!', false);
    } catch (error: any) {
      this.statusMessage = '';
      this.showMessage(`✗ Export failed: ${error?.message || 'Unknown error'}`, true);
    } finally {
      this.isProcessing = false;
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
      this.showMessage('✓ Data imported successfully!', false);
      this.showManualReloadButton = true;
    } catch (error: any) {
      this.statusMessage = '';
      this.showMessage(`✗ Import failed: ${error?.message || 'Unknown error'}`, true);
    } finally {
      this.isProcessing = false;
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
      this.showDriveMessage('✓ Signed in to Google Drive');
    } catch (error: any) {
      this.driveStatusMessage = '';
      this.showDriveMessage(`✗ Sign-in failed: ${error?.message || 'Unknown error'}`, true);
    } finally {
      this.isDriveProcessing = false;
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
      this.showDriveMessage('✓ Backup synced to Google Drive');
    } catch (error: any) {
      this.driveStatusMessage = '';
      this.showDriveMessage(`✗ Drive sync failed: ${error?.message || 'Unknown error'}`, true);
    } finally {
      this.isDriveProcessing = false;
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
      this.showDriveMessage('✓ Data restored from Google Drive');
      this.showReloadButton = true;
    } catch (error: any) {
      this.driveStatusMessage = '';
      this.showDriveMessage(`✗ Restore failed: ${error?.message || 'Unknown error'}`, true);
    } finally {
      this.isDriveProcessing = false;
    }
  }
}
