import { Injectable, signal } from '@angular/core';
import { EncryptionService } from './encryption.service';
import { googleDriveConfig } from '../../../environments/google-drive';

/**
 * Google Drive sync service for automatic backup and sync
 * Uses Google Drive API with OAuth2 authentication (Google Identity Services)
 *
 * Note: Requires gapi-script and Google Identity Services to be loaded via script tag
 */

export interface DriveConfig {
  clientId: string;
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
  private static readonly SIGNED_IN_KEY = 'google_drive_signed_in';
  // Sync status signal
  syncStatus = signal<SyncStatus>({
    isSignedIn: false,
    lastSyncTime: null,
    isSyncing: false,
    error: null,
  });
  private config: DriveConfig | null = null;
  private isInitialized = false;
  private accessToken: string | null = null;
  private tokenClient: any = null;

  constructor(private encryptionService: EncryptionService) {
  }

  /**
   * Initialize Google Drive API with Google Identity Services
   */
  async initialize(config: DriveConfig): Promise<void> {
    this.config = {
      ...config,
      useAppDataFolder: config.useAppDataFolder ?? true,
    };

    // If already initialized, check if we need to update the config
    if (this.isInitialized) {
      // Sign out if signed in, to force re-authentication with new scopes
      if (this.syncStatus().isSignedIn) {
        this.signOut();
      }
      // Reinitialize the token client with new scopes
      if (typeof google !== 'undefined' && google.accounts) {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.config.clientId,
          scope: this.getScopes(),
          callback: '',
        });
      }
      return;
    }

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Not in browser environment'));
        return;
      }

      if (typeof gapi === 'undefined') {
        reject(new Error('Google API script not loaded'));
        return;
      }

      // Load gapi client
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
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
          
          // Restore signed-in state from localStorage
          const wasSignedIn = localStorage.getItem(GoogleDriveSyncService.SIGNED_IN_KEY) === 'true';
          if (wasSignedIn && gapi.client.getToken() !== null) {
            this.syncStatus.update(status => ({
              ...status,
              isSignedIn: true,
            }));
          }
          
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
          gapi.client.setToken({access_token: response.access_token});
          localStorage.setItem(GoogleDriveSyncService.SIGNED_IN_KEY, 'true');
          this.syncStatus.update(status => ({
            ...status,
            isSignedIn: true,
            error: null,
          }));
          resolve();
        };

        if (gapi.client.getToken() !== null) {
          this.syncStatus.update(status => ({...status, isSignedIn: true}));
          resolve();
        } else {
          this.tokenClient.requestAccessToken({prompt: 'consent'});
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
    localStorage.removeItem(GoogleDriveSyncService.SIGNED_IN_KEY);
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
    await this.ensureInitialized();
    await this.ensureSignedIn();

    this.syncStatus.update(status => ({...status, isSyncing: true}));

    try {
      const content = encrypted ? data : await this.encryptionService.encrypt(data, 'default-password');
      const existing = await this.findExistingBackup();
      const fileId = existing?.id;
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const parents = this.getParentIds();
      const metadata: Record<string, any> = fileId ? {
        name: GoogleDriveSyncService.BACKUP_FILENAME,
        mimeType: 'application/json',
      } : {
        name: GoogleDriveSyncService.BACKUP_FILENAME,
        mimeType: 'application/json',
        ...(parents.length ? {parents} : {}),
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        closeDelimiter;

      await gapi.client.request({
        path: fileId ? `/upload/drive/v3/files/${fileId}` : '/upload/drive/v3/files',
        method: fileId ? 'PATCH' : 'POST',
        params: {uploadType: 'multipart'},
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

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

  /**
   * Download latest backup content from Drive
   */
  async downloadBackup(): Promise<string> {
    await this.ensureInitialized();
    await this.ensureSignedIn();

    const existing = await this.findExistingBackup();
    if (!existing) {
      throw new Error('No backup file found in Drive');
    }

    const response = await gapi.client.drive.files.get({
      fileId: existing.id,
      alt: 'media',
    });

    return response.body as string;
  }

  private getParentIds(): string[] {
    if (!this.config) return [];
    if (this.config.useAppDataFolder) return ['appDataFolder'];
    if (this.config.appFolderId) return [this.config.appFolderId];
    return [];
  }

  private async findExistingBackup(): Promise<DriveFile | null> {
    const parents = this.getParentIds();
    const qParts = [`name = '${GoogleDriveSyncService.BACKUP_FILENAME}'`, "mimeType = 'application/json'"];
    if (parents.length && parents[0] === 'appDataFolder') {
      qParts.push("'appDataFolder' in parents");
    }
    const query = qParts.join(' and ');
    const resp = await gapi.client.drive.files.list({
      q: query,
      spaces: this.config?.useAppDataFolder ? 'appDataFolder' : 'drive',
      fields: 'files(id, name, modifiedTime)',
      pageSize: 1,
    });
    const files = resp.result.files as DriveFile[] | undefined;
    return files?.[0] ?? null;
  }

  async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (!googleDriveConfig.clientId) {
      throw new Error('Google Drive config missing; check .env file (NG_APP_GOOGLE_CLIENT_ID)');
    }
    await this.initialize({
      clientId: googleDriveConfig.clientId,
      useAppDataFolder: true, // default value, can be overridden by calling initialize again
    });
  }

  private async ensureSignedIn(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('GoogleDriveSync not initialized');
    }
    if (gapi.client.getToken() !== null && this.accessToken) {
      return;
    }
    await this.signIn();
  }

  private getScopes(): string {
    return this.config?.useAppDataFolder
      ? 'https://www.googleapis.com/auth/drive.appdata'
      : 'https://www.googleapis.com/auth/drive.file';
  }
}
