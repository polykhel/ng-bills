import { Injectable } from '@angular/core';
import { IndexedDB, STORES } from '@core/storage/indexeddb';

@Injectable({
  providedIn: 'root',
})
export class IndexedDBService {
  private db = new IndexedDB();

  async init(): Promise<void> {
    await this.db.init();
  }

  getDB(): IndexedDB {
    if (!this.db.isReady()) {
      throw new Error('IndexedDB not initialized. Call init() via APP_INITIALIZER.');
    }
    return this.db;
  }

  async getStorageInfo() {
    return this.db.getStorageInfo();
  }

  async exportData(): Promise<string> {
    return this.db.exportAll();
  }

  async importData(jsonData: string): Promise<void> {
    await this.db.importAll(jsonData);
  }
}

// Re-export STORES for convenience
export { STORES };
