import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Download, Upload, Cloud, FileDown, Lock, AlertCircle } from 'lucide-angular';
import { SyncService, SyncUtilsService } from '../../core/services';

@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './sync.component.html',
})
export class SyncComponent implements OnInit {
  password = '';
  isEncrypted = true;
  isProcessing = false;
  message = '';
  isError = false;
  dataSize = 0;

  readonly Download = Download;
  readonly Upload = Upload;
  readonly Cloud = Cloud;
  readonly FileDown = FileDown;
  readonly Lock = Lock;
  readonly AlertCircle = AlertCircle;

  constructor(private syncService: SyncService, private syncUtils: SyncUtilsService) {}

  ngOnInit(): void {
    this.dataSize = this.syncUtils.getDataSize();
  }

  get passwordStrength(): 'weak' | 'medium' | 'strong' {
    return this.syncUtils.getPasswordStrength(this.password || '');
  }

  get strengthWidth(): string {
    if (this.passwordStrength === 'weak') return '33%';
    if (this.passwordStrength === 'medium') return '66%';
    return '100%';
  }

  get formattedDataSize(): string {
    return this.syncUtils.formatBytes(this.dataSize);
  }

  async handleExport(): Promise<void> {
    if (this.isEncrypted && !this.password) {
      this.showMessage('Please enter a password for encryption', true);
      return;
    }

    this.isProcessing = true;
    this.showMessage('');

    try {
      await this.syncService.downloadBackup(this.isEncrypted, this.password || undefined);
      this.showMessage('Backup downloaded successfully!', false);
    } catch (error: any) {
      this.showMessage(`Export failed: ${error?.message || 'Unknown error'}`, true);
    } finally {
      this.isProcessing = false;
    }
  }

  async handleImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.isEncrypted && !this.password) {
      this.showMessage('Please enter a password to decrypt', true);
      input.value = '';
      return;
    }

    this.isProcessing = true;
    this.showMessage('');

    try {
      await this.syncService.loadBackup(file, this.isEncrypted ? this.password : undefined);
      this.showMessage('Data imported successfully! Refreshing...', false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      this.showMessage(`Import failed: ${error?.message || 'Unknown error'}`, true);
    } finally {
      this.isProcessing = false;
      input.value = '';
    }
  }

  private showMessage(msg: string, isError = false): void {
    this.message = msg;
    this.isError = isError;
  }
}
