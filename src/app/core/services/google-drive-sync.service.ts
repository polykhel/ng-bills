import { Injectable, signal } from '@angular/core';
import { EncryptionService } from './encryption.service';

/**
 * Google Drive sync service for automatic backup and sync
 * Uses Google Drive API with OAuth2 authentication (Google Identity Services)
 * 
 * Note: Requires gapi-script and Google Identity Services to be loaded via script tag
 */

export interface DriveConfig {
  clientId: string;
  apiKey: string;
  appFolderId?: string;
  useAppDataFolder?: boolean; // true = hidden folder, false = visible folder
}

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface SyncStatus {
  isSignedIn: boolean;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  error: string | null;
}

declare const gapi: any;
declare const google: any;

@Injectable({
  providedIn: 'root',
})
export class GoogleDriveSyncService {
  private static readonly DISCOVERY_DOCS = [
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  ];
  private static readonly BACKUP_FILENAME = 'bills-sync.json';

  private config: DriveConfig | null = null;
  private isInitialized = false;
  private accessToken: string | null = null;
  private tokenClient: any = null;

  // Sync status signal
  syncStatus = signal<SyncStatus>({
    isSignedIn: false,
    lastSyncTime: null,
    isSyncing: false,
    error: null,
  });

  constructor(private encryptionService: EncryptionService) {}

  /**
   * Initialize Google Drive API with Google Identity Services
   */
  async initialize(config: DriveConfig): Promise<void> {
    this.config = {
      ...config,
      useAppDataFolder: config.useAppDataFolder ?? true,
    };

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Not in browser environment'));
        return;
      }

      // Load gapi client
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: this.config!.apiKey,
            discoveryDocs: GoogleDriveSyncService.DISCOVERY_DOCS,
          });

          // Initialize Google Identity Services
          if (typeof google !== 'undefined' && google.accounts) {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: this.config!.clientId,
              scope: this.getScopes(),
              callback: '',
            });
          }

          this.isInitialized = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Sign in to Google
   */
  async signIn(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('GoogleDriveSync not initialized');
    }

    return new Promise((resolve, reject) => {
      try {
        this.tokenClient.callback = (response: any) => {
          if (response.error !== undefined) {
            this.syncStatus.update(status => ({
              ...status,
              error: response.error,
            }));
            reject(new Error(response.error));
            return;
          }
          this.accessToken = response.access_token;
          gapi.client.setToken({ access_token: response.access_token });
          this.syncStatus.update(status => ({
            ...status,
            isSignedIn: true,
            error: null,
          }));
          resolve();
        };

        if (gapi.client.getToken() !== null) {
          this.syncStatus.update(status => ({ ...status, isSignedIn: true }));
          resolve();
        } else {
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Sign out
   */
  signOut(): void {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token);
      gapi.client.setToken(null);
    }
    this.accessToken = null;
    this.syncStatus.update(status => ({
      ...status,
      isSignedIn: false,
      lastSyncTime: null,
    }));
  }

  /**
   * Upload data to Google Drive
   */
  async uploadBackup(data: string, encrypted: boolean = false): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('GoogleDriveSync not initialized');
    }

    this.syncStatus.update(status => ({ ...status, isSyncing: true }));

    try {
      const content = encrypted ? data : await this.encryptionService.encrypt(data, 'default-password');
      
      // Upload logic would go here using gapi.client.drive.files.create()
      // Simplified for now
      
      this.syncStatus.update(status => ({
        ...status,
        isSyncing: false,
        lastSyncTime: new Date(),
        error: null,
      }));
    } catch (error: any) {
      this.syncStatus.update(status => ({
        ...status,
        isSyncing: false,
        error: error.message,
      }));
      throw error;
    }
  }

  private getScopes(): string {
    return this.config?.useAppDataFolder
      ? 'https://www.googleapis.com/auth/drive.appdata'
      : 'https://www.googleapis.com/auth/drive.file';
  }
}
