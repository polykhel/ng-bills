import { Injectable } from '@angular/core';
import { EncryptionService } from './encryption.service';
import { IndexedDBService } from './indexeddb.service';
import type { BankBalance, CreditCard, Installment, Profile, Statement, Transaction } from '@shared/types';

export interface SyncData {
  version: string;
  timestamp: string;
  profiles: Profile[];
  cards: CreditCard[];
  statements: Statement[];
  installments: Installment[];
  transactions?: Transaction[]; // Added in Phase 2 - includes migrated recurring/installment transactions
  // cashInstallments removed in Phase 2 - migrated to recurring transactions
  bankBalances: BankBalance[];
  bankBalanceTrackingEnabled: boolean;
  activeProfileId: string | null;
  activeMonth: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private readonly VERSION = '1.0.0';

  constructor(
    private encryption: EncryptionService,
    private idb: IndexedDBService,
  ) {}

  /**
   * Export all data to a JSON string
   */
  async exportData(): Promise<string> {
    return this.idb.exportData();
  }

  /**
   * Export encrypted data
   */
  async exportEncrypted(password: string): Promise<string> {
    const jsonData = await this.exportData();
    const encrypted = await this.encryption.encrypt(jsonData, password);

    return JSON.stringify(
      {
        encrypted: true,
        version: this.VERSION,
        timestamp: new Date().toISOString(),
        data: encrypted,
      },
      null,
      2,
    );
  }

  /**
   * Import data from JSON string
   */
  async importData(jsonString: string, password?: string): Promise<void> {
    let data: SyncData;

    try {
      const parsed = JSON.parse(jsonString);

      // Check if data is encrypted
      if (parsed.encrypted) {
        if (!password) {
          throw new Error('Password required for encrypted data');
        }
        const decrypted = await this.encryption.decrypt(parsed.data, password);
        data = JSON.parse(decrypted);
      } else {
        data = parsed;
      }

      // Validate version
      if (!data.version || data.version !== this.VERSION) {
        console.warn('Data version mismatch. Attempting import anyway.');
      }

      // Import all data via IndexedDBService
      await this.idb.importData(jsonString);
    } catch (error) {
      console.error('Import failed:', error);
      throw new Error('Failed to import data. Please check the file and password.');
    }
  }

  /**
   * Download data as a file
   */
  async downloadBackup(encrypted: boolean = true, password?: string): Promise<void> {
    let content: string;
    let filename: string;

    if (encrypted && password) {
      content = await this.exportEncrypted(password);
      filename = `bills-backup-encrypted-${Date.now()}.json`;
    } else {
      content = await this.exportData();
      filename = `bills-backup-${Date.now()}.json`;
    }

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Load data from a file
   */
  async loadBackup(file: File, password?: string): Promise<void> {
    const content = await file.text();
    await this.importData(content, password);
  }
}
