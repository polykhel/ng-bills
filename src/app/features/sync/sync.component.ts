import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertCircle,
  Cloud,
  Database,
  Download,
  FileDown,
  Lock,
  LogIn,
  LogOut,
  LucideAngularModule,
  Upload,
} from 'lucide-angular';
import { SyncService, SyncUtilsService } from '@services';
import { FirebaseAuthService } from '@services/firebase-auth.service';
import { FirebaseSyncService } from '@services/firebase-sync.service';
import { initializeApp } from '@angular/fire/app';
import { getAuth } from '@angular/fire/auth';
import { getFirestore } from '@angular/fire/firestore';
import { firebaseConfig, isFirebaseConfigured } from '@environments/firebase';
import { StorageSettingsComponent } from './components/storage-settings.component';

@Component({
  selector: 'app-sync',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, StorageSettingsComponent],
  templateUrl: './sync.component.html',
})
export class SyncComponent implements OnInit {
  manualPassword = '';
  manualEncrypted = true;
  isProcessing = false;
  message = '';
  isError = false;
  dataSize = 0;
  statusMessage = '';

  readonly Download = Download;
  readonly Upload = Upload;
  readonly FileDown = FileDown;
  readonly Lock = Lock;
  readonly AlertCircle = AlertCircle;
  readonly LogIn = LogIn;
  readonly LogOut = LogOut;
  readonly Database = Database;

  // Firebase
  firebaseAuth?: FirebaseAuthService;
  firebaseSync?: FirebaseSyncService;
  firebaseEmail = '';
  firebasePassword = '';
  firebaseDisplayName = '';
  isFirebaseConfigured = false;
  showSignUp = false;
  firebaseMessage = '';
  firebaseError = false;
  isFirebaseProcessing = false;
  firebaseStatusMessage = '';
  firebaseAuthState: any;
  firebaseSyncStatus: any;

  constructor(
    private syncService: SyncService,
    private syncUtils: SyncUtilsService,
  ) {
    this.initializeFirebase();
  }

  get manualPasswordStrength(): 'weak' | 'medium' | 'strong' {
    return this.syncUtils.getPasswordStrength(this.manualPassword || '');
  }

  get manualStrengthWidth(): string {
    if (this.manualPasswordStrength === 'weak') return '33%';
    if (this.manualPasswordStrength === 'medium') return '66%';
    return '100%';
  }

  get formattedDataSize(): string {
    return this.syncUtils.formatBytes(this.dataSize);
  }

  ngOnInit(): void {
    this.dataSize = this.syncUtils.getDataSize();
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
      this.isProcessing = false;
      this.showMessage('✓ Backup downloaded successfully!', false);
    } catch (error: any) {
      this.statusMessage = '';
      this.isProcessing = false;
      this.showMessage(`✗ Export failed: ${error?.message || 'Unknown error'}`, true);
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
      await this.syncService.loadBackup(
        file,
        this.manualEncrypted ? this.manualPassword : undefined,
      );
      this.statusMessage = '';
      this.isProcessing = false;
      this.showMessage('✓ Data imported successfully! Reloading...', false);
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      this.statusMessage = '';
      this.isProcessing = false;
      this.showMessage(`✗ Import failed: ${error?.message || 'Unknown error'}`, true);
    } finally {
      input.value = '';
    }
  }

  // Firebase Auth Methods
  async handleFirebaseSignIn(): Promise<void> {
    if (!this.firebaseAuth) return;

    this.isFirebaseProcessing = true;
    this.firebaseStatusMessage = 'Signing in...';
    this.showFirebaseMessage('');

    try {
      await this.firebaseAuth.signInWithEmail(this.firebaseEmail, this.firebasePassword);
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage('✓ Signed in successfully!');
      this.firebasePassword = '';
    } catch (error: any) {
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage(`✗ Sign-in failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  async handleFirebaseSignUp(): Promise<void> {
    if (!this.firebaseAuth) return;

    this.isFirebaseProcessing = true;
    this.firebaseStatusMessage = 'Creating account...';
    this.showFirebaseMessage('');

    try {
      await this.firebaseAuth.signUpWithEmail(
        this.firebaseEmail,
        this.firebasePassword,
        this.firebaseDisplayName || undefined,
      );
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage('✓ Account created successfully!');
      this.firebasePassword = '';
      this.showSignUp = false;
    } catch (error: any) {
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage(`✗ Sign-up failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  async handleFirebaseGoogleSignIn(): Promise<void> {
    if (!this.firebaseAuth) return;

    this.isFirebaseProcessing = true;
    this.firebaseStatusMessage = 'Signing in with Google...';
    this.showFirebaseMessage('');

    try {
      await this.firebaseAuth.signInWithGoogle();
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage('✓ Signed in with Google!');
    } catch (error: any) {
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage(
        `✗ Google sign-in failed: ${error?.message || 'Unknown error'}`,
        true,
      );
    }
  }

  async handleFirebaseSignOut(): Promise<void> {
    if (!this.firebaseAuth) return;

    try {
      await this.firebaseAuth.signOut();
      this.showFirebaseMessage('Signed out successfully');
    } catch (error: any) {
      this.showFirebaseMessage(`✗ Sign-out failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  // Firebase Sync Methods
  async handleFirebaseEnableSync(): Promise<void> {
    if (!this.firebaseSync) return;

    this.isFirebaseProcessing = true;
    this.firebaseStatusMessage = 'Enabling real-time sync...';
    this.showFirebaseMessage('');

    try {
      await this.firebaseSync.enableSync();
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage('✓ Real-time sync enabled!');
    } catch (error: any) {
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage(`✗ Enable sync failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  handleFirebaseDisableSync(): void {
    if (!this.firebaseSync) return;
    this.firebaseSync.disableSync();
    this.showFirebaseMessage('Real-time sync disabled');
  }

  async handleFirebasePush(): Promise<void> {
    if (!this.firebaseSync) return;

    this.isFirebaseProcessing = true;
    this.firebaseStatusMessage = 'Pushing data to cloud...';
    this.showFirebaseMessage('');

    try {
      await this.firebaseSync.pushToCloud();
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage('✓ Data synced to cloud!');
    } catch (error: any) {
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage(`✗ Push failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  async handleFirebasePull(): Promise<void> {
    if (!this.firebaseSync) return;

    this.isFirebaseProcessing = true;
    this.firebaseStatusMessage = 'Pulling data from cloud...';
    this.showFirebaseMessage('');

    try {
      await this.firebaseSync.pullFromCloud();
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage('✓ Data pulled from cloud! Reloading...');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      this.firebaseStatusMessage = '';
      this.isFirebaseProcessing = false;
      this.showFirebaseMessage(`✗ Pull failed: ${error?.message || 'Unknown error'}`, true);
    }
  }

  private async initializeFirebase(): Promise<void> {
    this.isFirebaseConfigured = isFirebaseConfigured();

    if (this.isFirebaseConfigured) {
      try {
        // Dynamically initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const firestore = getFirestore(app);

        this.firebaseAuth = inject(FirebaseAuthService);
        this.firebaseSync = inject(FirebaseSyncService);

        await this.firebaseAuth.initialize(auth);
        await this.firebaseSync.initialize(firestore);

        this.firebaseAuthState = this.firebaseAuth.authState;
        this.firebaseSyncStatus = this.firebaseSync.syncStatus;
      } catch (error) {
        console.error('Firebase initialization failed:', error);
        this.isFirebaseConfigured = false;
      }
    }
  }

  private showMessage(msg: string, isError = false): void {
    this.message = msg;
    this.isError = isError;
  }

  private showFirebaseMessage(msg: string, isError = false): void {
    this.firebaseMessage = msg;
    this.firebaseError = isError;
  }

  protected readonly Cloud = Cloud;
}
