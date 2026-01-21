/**
 * StorageFactory
 * 
 * Factory for creating and managing storage providers.
 * Handles automatic detection and migration between storage types.
 */

import { Injectable } from '@angular/core';
import type { StorageProvider } from './storage-provider.interface';
import { LocalStorageProvider } from './local-storage.provider';
import { IndexedDBProvider } from './indexeddb.provider';

export type StorageType = 'local' | 'indexeddb';

const MIGRATION_KEY = 'bt_storage_migration';
const STORAGE_TYPE_KEY = 'bt_storage_type';

interface MigrationStatus {
  migrated: boolean;
  fromType: StorageType;
  toType: StorageType;
  migratedAt: string;
  recordCount: {
    profiles: number;
    cards: number;
    statements: number;
    installments: number;
    cashInstallments: number;
    bankBalances: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class StorageFactory {
  private currentProvider: StorageProvider | null = null;

  /**
   * Create a storage provider of the specified type.
   */
  async createProvider(type: StorageType): Promise<StorageProvider> {
    let provider: StorageProvider;

    switch (type) {
      case 'indexeddb':
        provider = new IndexedDBProvider();
        break;
      case 'local':
      default:
        provider = new LocalStorageProvider();
        break;
    }

    await provider.init();
    return provider;
  }

  /**
   * Get the current active storage provider.
   * Auto-detects and migrates if needed.
   */
  async getProvider(): Promise<StorageProvider> {
    if (this.currentProvider) {
      return this.currentProvider;
    }

    // Check if migration is needed
    const migrationStatus = this.getMigrationStatus();
    
    if (!migrationStatus.migrated && this.hasLocalStorageData()) {
      // Auto-migrate from LocalStorage to IndexedDB
      console.log('Detecting existing LocalStorage data - migrating to IndexedDB...');
      await this.migrateToIndexedDB();
    }

    // Determine which provider to use
    const storageType = this.getPreferredStorageType();
    this.currentProvider = await this.createProvider(storageType);
    
    return this.currentProvider;
  }

  /**
   * Check if there's existing data in LocalStorage.
   */
  private hasLocalStorageData(): boolean {
    if (typeof window === 'undefined') return false;
    
    const keys = [
      'bt_profiles',
      'bt_cards',
      'bt_statements',
      'bt_installments',
      'bt_cash_installments',
      'bt_bank_balances'
    ];

    return keys.some(key => {
      const item = localStorage.getItem(key);
      if (!item) return false;
      try {
        const data = JSON.parse(item);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return false;
      }
    });
  }

  /**
   * Get the migration status.
   */
  private getMigrationStatus(): MigrationStatus {
    if (typeof window === 'undefined') {
      return { migrated: false, fromType: 'local', toType: 'indexeddb', migratedAt: '', recordCount: {} } as any;
    }

    try {
      const status = localStorage.getItem(MIGRATION_KEY);
      if (status) {
        return JSON.parse(status);
      }
    } catch (e) {
      console.error('Error reading migration status:', e);
    }

    return { migrated: false, fromType: 'local', toType: 'indexeddb', migratedAt: '', recordCount: {} } as any;
  }

  /**
   * Save the migration status.
   */
  private saveMigrationStatus(status: MigrationStatus): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MIGRATION_KEY, JSON.stringify(status));
    } catch (e) {
      console.error('Error saving migration status:', e);
    }
  }

  /**
   * Get the preferred storage type.
   */
  private getPreferredStorageType(): StorageType {
    if (typeof window === 'undefined') return 'local';

    try {
      const saved = localStorage.getItem(STORAGE_TYPE_KEY);
      if (saved === 'local' || saved === 'indexeddb') {
        return saved as StorageType;
      }
    } catch (e) {
      console.error('Error reading storage type preference:', e);
    }

    // Default to IndexedDB for better performance and capacity
    return 'indexeddb';
  }

  /**
   * Set the preferred storage type.
   */
  async setStorageType(type: StorageType): Promise<void> {
    if (typeof window === 'undefined') return;

    localStorage.setItem(STORAGE_TYPE_KEY, type);
    
    // Reinitialize with new provider
    this.currentProvider = await this.createProvider(type);
  }

  /**
   * Migrate data from LocalStorage to IndexedDB.
   */
  async migrateToIndexedDB(): Promise<void> {
    console.log('Starting migration from LocalStorage to IndexedDB...');

    const localProvider = new LocalStorageProvider();
    await localProvider.init();

    const indexedDBProvider = new IndexedDBProvider();
    await indexedDBProvider.init();

    try {
      // Export data from LocalStorage
      const jsonData = await localProvider.exportData();
      
      // Import into IndexedDB
      await indexedDBProvider.importData(jsonData);

      // Count migrated records
      const profiles = await indexedDBProvider.getProfiles();
      const cards = await indexedDBProvider.getCards();
      const statements = await indexedDBProvider.getStatements();
      const installments = await indexedDBProvider.getInstallments();
      const cashInstallments = await indexedDBProvider.getCashInstallments();
      const bankBalances = await indexedDBProvider.getBankBalances();

      const recordCount = {
        profiles: profiles.length,
        cards: cards.length,
        statements: statements.length,
        installments: installments.length,
        cashInstallments: cashInstallments.length,
        bankBalances: bankBalances.length
      };

      // Save migration status
      const migrationStatus: MigrationStatus = {
        migrated: true,
        fromType: 'local',
        toType: 'indexeddb',
        migratedAt: new Date().toISOString(),
        recordCount
      };

      this.saveMigrationStatus(migrationStatus);
      
      console.log('Migration completed successfully:', recordCount);
      console.log('LocalStorage data has been preserved as backup');
    } catch (error) {
      console.error('Migration failed:', error);
      throw new Error(`Migration from LocalStorage to IndexedDB failed: ${error}`);
    }
  }

  /**
   * Get migration information for display to user.
   */
  getMigrationInfo(): MigrationStatus | null {
    const status = this.getMigrationStatus();
    return status.migrated ? status : null;
  }

  /**
   * Force a re-migration (for testing or recovery).
   */
  async forceMigration(): Promise<void> {
    // Clear migration status
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MIGRATION_KEY);
    }
    
    // Reset current provider
    this.currentProvider = null;
    
    // Trigger migration
    await this.migrateToIndexedDB();
  }

  /**
   * Export data from current provider.
   */
  async exportCurrentData(): Promise<string> {
    const provider = await this.getProvider();
    return provider.exportData();
  }

  /**
   * Get storage statistics.
   */
  async getStorageStats(): Promise<{
    type: StorageType;
    info: { used: number; available: number; percentage: number } | null;
    providerName: string;
  }> {
    const provider = await this.getProvider();
    const info = await provider.getStorageInfo();
    const type = this.getPreferredStorageType();

    return {
      type,
      info,
      providerName: provider.getProviderName()
    };
  }
}
