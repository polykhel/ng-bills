import { Injectable } from '@angular/core';
import { EncryptionService } from './encryption.service';
import { StorageService } from './storage.service';
import type { CashInstallment, CreditCard, Installment, Profile, Statement } from '@shared/types';

export interface SyncData {
  version: string;
  timestamp: string;
  profiles: Profile[];
  cards: CreditCard[];
  statements: Statement[];
  installments: Installment[];
  cashInstallments: CashInstallment[];
  activeProfileId: string | null;
  activeMonth: string | null;
}

export interface SyncOptions {
  password?: string;
  encrypted?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private readonly VERSION = '1.0.0';

  constructor(
    private encryption: EncryptionService,
    private storage: StorageService
  ) {
  }

  /**
   * Export all data to a JSON string
   */
  exportData(options: SyncOptions = {}): string {
    const data: SyncData = {
      version: this.VERSION,
      timestamp: new Date().toISOString(),
      profiles: this.storage.getProfiles(),
      cards: this.storage.getCards(),
      statements: this.storage.getStatements(),
      installments: this.storage.getInstallments(),
      cashInstallments: this.storage.getCashInstallments(),
      activeProfileId: this.storage.getActiveProfileId(),
      activeMonth: this.storage.getActiveMonthStr(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export encrypted data
   */
  async exportEncrypted(password: string): Promise<string> {
    const jsonData = this.exportData();
    const encrypted = await this.encryption.encrypt(jsonData, password);

    return JSON.stringify({
      encrypted: true,
      version: this.VERSION,
      timestamp: new Date().toISOString(),
      data: encrypted,
    }, null, 2);
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

      // Import all data
      if (data.profiles) this.storage.saveProfiles(data.profiles);
      if (data.cards) this.storage.saveCards(data.cards);
      if (data.statements) this.storage.saveStatements(data.statements);
      if (data.installments) this.storage.saveInstallments(data.installments);
      if (data.cashInstallments) this.storage.saveCashInstallments(data.cashInstallments);
      if (data.activeProfileId) this.storage.saveActiveProfileId(data.activeProfileId);
      if (data.activeMonth) this.storage.saveActiveMonthStr(data.activeMonth);

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
      content = this.exportData();
      filename = `bills-backup-${Date.now()}.json`;
    }

    const blob = new Blob([content], {type: 'application/json'});
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

  /**
   * Merge imported data with existing data
   * Uses timestamps and IDs to determine conflicts
   */
  async mergeData(jsonString: string, password?: string): Promise<void> {
    let importedData: SyncData;

    try {
      const parsed = JSON.parse(jsonString);

      if (parsed.encrypted) {
        if (!password) {
          throw new Error('Password required for encrypted data');
        }
        const decrypted = await this.encryption.decrypt(parsed.data, password);
        importedData = JSON.parse(decrypted);
      } else {
        importedData = parsed;
      }

      // Merge profiles (keep both, user can delete duplicates)
      const existingProfiles = this.storage.getProfiles();
      const newProfiles = [...existingProfiles];
      for (const profile of importedData.profiles) {
        if (!existingProfiles.find(p => p.id === profile.id)) {
          newProfiles.push(profile);
        }
      }
      this.storage.saveProfiles(newProfiles);

      // Merge cards
      const existingCards = this.storage.getCards();
      const newCards = [...existingCards];
      for (const card of importedData.cards) {
        if (!existingCards.find(c => c.id === card.id)) {
          newCards.push(card);
        }
      }
      this.storage.saveCards(newCards);

      // Merge statements
      const existingStatements = this.storage.getStatements();
      const newStatements = [...existingStatements];
      for (const statement of importedData.statements) {
        const existingIndex = existingStatements.findIndex(
          s => s.id === statement.id
        );
        if (existingIndex === -1) {
          newStatements.push(statement);
        }
      }
      this.storage.saveStatements(newStatements);

      // Merge installments
      const existingInstallments = this.storage.getInstallments();
      const newInstallments = [...existingInstallments];
      for (const installment of importedData.installments) {
        if (!existingInstallments.find(i => i.id === installment.id)) {
          newInstallments.push(installment);
        }
      }
      this.storage.saveInstallments(newInstallments);

      // Merge cash installments
      const existingCashInstallments = this.storage.getCashInstallments();
      const newCashInstallments = [...existingCashInstallments];
      for (const cashInstallment of importedData.cashInstallments || []) {
        if (!existingCashInstallments.find(i => i.id === cashInstallment.id)) {
          newCashInstallments.push(cashInstallment);
        }
      }
      this.storage.saveCashInstallments(newCashInstallments);

    } catch (error) {
      console.error('Merge failed:', error);
      throw new Error('Failed to merge data. Please check the file and password.');
    }
  }
}
