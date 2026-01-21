import { Injectable } from '@angular/core';
import { IndexedDBService, STORES } from './indexeddb.service';
import type { CashInstallment, CreditCard, Installment, Profile, Statement } from '@shared/types';

@Injectable({
  providedIn: 'root',
})
export class SyncUtilsService {
  constructor(private idb: IndexedDBService) {}

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
  async hasLocalData(): Promise<boolean> {
    const db = this.idb.getDB();

    const profiles = await db.getAll<Profile>(STORES.PROFILES);
    const cards = await db.getAll<CreditCard>(STORES.CARDS);
    const statements = await db.getAll<Statement>(STORES.STATEMENTS);
    const installments = await db.getAll<Installment>(STORES.INSTALLMENTS);
    const cashInstallments = await db.getAll<CashInstallment>(STORES.CASH_INSTALLMENTS);

    return (
      profiles.length > 0 ||
      cards.length > 0 ||
      statements.length > 0 ||
      installments.length > 0 ||
      cashInstallments.length > 0
    );
  }

  /**
   * Get data size in bytes (approximate)
   */
  async getDataSize(): Promise<number> {
    const db = this.idb.getDB();

    const data = {
      profiles: await db.getAll<Profile>(STORES.PROFILES),
      cards: await db.getAll<CreditCard>(STORES.CARDS),
      statements: await db.getAll<Statement>(STORES.STATEMENTS),
      installments: await db.getAll<Installment>(STORES.INSTALLMENTS),
      cashInstallments: await db.getAll<CashInstallment>(STORES.CASH_INSTALLMENTS),
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
