import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class SyncUtilsService {
  constructor(private storage: StorageService) {}

  /**
   * Get a timestamp of the last local data modification
   * This is used to determine if local or cloud data is newer
   */
  getLastModifiedTimestamp(): string {
    const lastSync = localStorage.getItem('bt_last_sync');
    if (lastSync) {
      return lastSync;
    }

    // If no sync timestamp, use current time
    const now = new Date().toISOString();
    localStorage.setItem('bt_last_sync', now);
    return now;
  }

  /**
   * Update the last sync timestamp
   */
  updateLastSyncTimestamp(): void {
    localStorage.setItem('bt_last_sync', new Date().toISOString());
  }

  /**
   * Check if data exists (for first-time setup detection)
   */
  hasLocalData(): boolean {
    const profiles = this.storage.getProfiles();
    const cards = this.storage.getCards();
    const statements = this.storage.getStatements();
    const installments = this.storage.getInstallments();
    const cashInstallments = this.storage.getCashInstallments();
    const oneTimeBills = this.storage.getOneTimeBills();

    return (
      profiles.length > 0 ||
      cards.length > 0 ||
      statements.length > 0 ||
      installments.length > 0 ||
      cashInstallments.length > 0 ||
      oneTimeBills.length > 0
    );
  }

  /**
   * Get data size in bytes (approximate)
   */
  getDataSize(): number {
    const data = {
      profiles: this.storage.getProfiles(),
      cards: this.storage.getCards(),
      statements: this.storage.getStatements(),
      installments: this.storage.getInstallments(),
      cashInstallments: this.storage.getCashInstallments(),
      oneTimeBills: this.storage.getOneTimeBills(),
    };

    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Validate password strength
   * Returns array of validation messages
   */
  validatePassword(password: string): string[] {
    const issues: string[] = [];

    if (password.length < 8) {
      issues.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      issues.push('Password should contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      issues.push('Password should contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      issues.push('Password should contain at least one number');
    }

    return issues;
  }

  /**
   * Get password strength level
   */
  getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    const issues = this.validatePassword(password);

    if (issues.length >= 3) return 'weak';
    if (issues.length >= 1) return 'medium';
    return 'strong';
  }

  /**
   * Generate a random password
   */
  generatePassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    const array = new Uint8Array(length);
    crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }

    return password;
  }

  /**
   * Clear all sync-related data
   */
  clearSyncData(): void {
    localStorage.removeItem('bt_last_sync');
    localStorage.removeItem('bt_sync_password');
    localStorage.removeItem('bt_auto_sync');
  }
}
