import { Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
  serverTimestamp,
} from '@angular/fire/firestore';
import { FirebaseAuthService } from './firebase-auth.service';
import { StorageService } from './storage.service';
import type { 
  BankBalance, 
  CashInstallment, 
  CreditCard, 
  Installment, 
  Profile, 
  Statement 
} from '@shared/types';

export interface FirestoreSyncStatus {
  isEnabled: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  error: string | null;
}

/**
 * Firebase Firestore sync service
 * Provides real-time synchronization of user data to Firestore
 * Data is stored per user in their own subcollection
 */
@Injectable({
  providedIn: 'root',
})
export class FirebaseSyncService {
  syncStatus = signal<FirestoreSyncStatus>({
    isEnabled: false,
    isSyncing: false,
    lastSyncTime: null,
    error: null,
  });

  private firestore: Firestore | null = null;
  private unsubscribes: Unsubscribe[] = [];
  private isListening = false;

  constructor(
    private authService: FirebaseAuthService,
    private storageService: StorageService
  ) {}

  /**
   * Initialize Firestore sync
   */
  async initialize(firestore: Firestore): Promise<void> {
    this.firestore = firestore;
  }

  /**
   * Enable real-time sync for authenticated user
   */
  async enableSync(): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('User must be authenticated to enable sync');
    }

    this.ensureInitialized();
    
    this.syncStatus.update(state => ({ ...state, isEnabled: true, isSyncing: true }));

    try {
      // First, upload current local data to Firestore
      await this.uploadAllData(userId);

      // Then start listening to changes
      this.startListening(userId);

      this.syncStatus.update(state => ({
        ...state,
        isSyncing: false,
        lastSyncTime: new Date(),
        error: null,
      }));
    } catch (error: any) {
      this.syncStatus.update(state => ({
        ...state,
        isEnabled: false,
        isSyncing: false,
        error: error.message,
      }));
      throw error;
    }
  }

  /**
   * Disable real-time sync
   */
  disableSync(): void {
    this.stopListening();
    this.syncStatus.update(state => ({
      ...state,
      isEnabled: false,
      isSyncing: false,
    }));
  }

  /**
   * Manual sync: push local data to Firestore
   */
  async pushToCloud(): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('User must be authenticated to sync');
    }

    this.ensureInitialized();
    this.syncStatus.update(state => ({ ...state, isSyncing: true, error: null }));

    try {
      await this.uploadAllData(userId);
      
      this.syncStatus.update(state => ({
        ...state,
        isSyncing: false,
        lastSyncTime: new Date(),
      }));
    } catch (error: any) {
      this.syncStatus.update(state => ({
        ...state,
        isSyncing: false,
        error: error.message,
      }));
      throw error;
    }
  }

  /**
   * Manual sync: pull data from Firestore to local storage
   */
  async pullFromCloud(): Promise<void> {
    const userId = this.authService.getCurrentUserId();
    if (!userId) {
      throw new Error('User must be authenticated to sync');
    }

    this.ensureInitialized();
    this.syncStatus.update(state => ({ ...state, isSyncing: true, error: null }));

    try {
      await this.downloadAllData(userId);
      
      this.syncStatus.update(state => ({
        ...state,
        isSyncing: false,
        lastSyncTime: new Date(),
      }));
    } catch (error: any) {
      this.syncStatus.update(state => ({
        ...state,
        isSyncing: false,
        error: error.message,
      }));
      throw error;
    }
  }

  /**
   * Upload all local data to Firestore
   */
  private async uploadAllData(userId: string): Promise<void> {
    const batch = writeBatch(this.firestore!);
    const userDocRef = doc(this.firestore!, 'users', userId);

    // Upload metadata
    batch.set(userDocRef, {
      lastModified: serverTimestamp(),
      version: '1.0.0',
    }, { merge: true });

    // Upload profiles
    const profiles = this.storageService.getProfiles();
    const profilesRef = collection(this.firestore!, `users/${userId}/profiles`);
    for (const profile of profiles) {
      batch.set(doc(profilesRef, profile.id), profile);
    }

    // Upload cards
    const cards = this.storageService.getCards();
    const cardsRef = collection(this.firestore!, `users/${userId}/cards`);
    for (const card of cards) {
      batch.set(doc(cardsRef, card.id), card);
    }

    // Upload statements
    const statements = this.storageService.getStatements();
    const statementsRef = collection(this.firestore!, `users/${userId}/statements`);
    for (const statement of statements) {
      batch.set(doc(statementsRef, statement.id), statement);
    }

    // Upload installments
    const installments = this.storageService.getInstallments();
    const installmentsRef = collection(this.firestore!, `users/${userId}/installments`);
    for (const installment of installments) {
      batch.set(doc(installmentsRef, installment.id), installment);
    }

    // Upload cash installments
    const cashInstallments = this.storageService.getCashInstallments();
    const cashInstallmentsRef = collection(this.firestore!, `users/${userId}/cashInstallments`);
    for (const cashInstallment of cashInstallments) {
      batch.set(doc(cashInstallmentsRef, cashInstallment.id), cashInstallment);
    }

    // Upload bank balances
    const bankBalances = this.storageService.getBankBalances();
    const bankBalancesRef = collection(this.firestore!, `users/${userId}/bankBalances`);
    for (const bankBalance of bankBalances) {
      batch.set(doc(bankBalancesRef, bankBalance.id), bankBalance);
    }

    // Upload settings
    const settingsRef = doc(this.firestore!, `users/${userId}/settings/app`);
    batch.set(settingsRef, {
      bankBalanceTrackingEnabled: this.storageService.getBankBalanceTrackingEnabled(),
      activeProfileId: this.storageService.getActiveProfileId(),
      activeMonth: this.storageService.getActiveMonthStr(),
    });

    await batch.commit();
  }

  /**
   * Download all data from Firestore to local storage
   */
  private async downloadAllData(userId: string): Promise<void> {
    // Download profiles
    const profilesSnapshot = await getDocs(
      collection(this.firestore!, `users/${userId}/profiles`)
    );
    const profiles = profilesSnapshot.docs.map(doc => doc.data() as Profile);
    if (profiles.length > 0) {
      this.storageService.saveProfiles(profiles);
    }

    // Download cards
    const cardsSnapshot = await getDocs(
      collection(this.firestore!, `users/${userId}/cards`)
    );
    const cards = cardsSnapshot.docs.map(doc => doc.data() as CreditCard);
    if (cards.length > 0) {
      this.storageService.saveCards(cards);
    }

    // Download statements
    const statementsSnapshot = await getDocs(
      collection(this.firestore!, `users/${userId}/statements`)
    );
    const statements = statementsSnapshot.docs.map(doc => doc.data() as Statement);
    if (statements.length > 0) {
      this.storageService.saveStatements(statements);
    }

    // Download installments
    const installmentsSnapshot = await getDocs(
      collection(this.firestore!, `users/${userId}/installments`)
    );
    const installments = installmentsSnapshot.docs.map(doc => doc.data() as Installment);
    if (installments.length > 0) {
      this.storageService.saveInstallments(installments);
    }

    // Download cash installments
    const cashInstallmentsSnapshot = await getDocs(
      collection(this.firestore!, `users/${userId}/cashInstallments`)
    );
    const cashInstallments = cashInstallmentsSnapshot.docs.map(
      doc => doc.data() as CashInstallment
    );
    if (cashInstallments.length > 0) {
      this.storageService.saveCashInstallments(cashInstallments);
    }

    // Download bank balances
    const bankBalancesSnapshot = await getDocs(
      collection(this.firestore!, `users/${userId}/bankBalances`)
    );
    const bankBalances = bankBalancesSnapshot.docs.map(doc => doc.data() as BankBalance);
    if (bankBalances.length > 0) {
      this.storageService.saveBankBalances(bankBalances);
    }

    // Download settings
    const settingsDoc = await getDoc(
      doc(this.firestore!, `users/${userId}/settings/app`)
    );
    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();
      if (settings['bankBalanceTrackingEnabled'] !== undefined) {
        this.storageService.saveBankBalanceTrackingEnabled(settings['bankBalanceTrackingEnabled']);
      }
      if (settings['activeProfileId']) {
        this.storageService.saveActiveProfileId(settings['activeProfileId']);
      }
      if (settings['activeMonth']) {
        this.storageService.saveActiveMonthStr(settings['activeMonth']);
      }
    }
  }

  /**
   * Start listening to Firestore changes
   */
  private startListening(userId: string): void {
    if (this.isListening) {
      return;
    }

    this.isListening = true;

    // Listen to profiles
    const profilesUnsubscribe = onSnapshot(
      collection(this.firestore!, `users/${userId}/profiles`),
      (snapshot) => {
        const profiles = snapshot.docs.map(doc => doc.data() as Profile);
        this.storageService.saveProfiles(profiles);
      },
      (error) => {
        console.error('Error listening to profiles:', error);
      }
    );
    this.unsubscribes.push(profilesUnsubscribe);

    // Listen to cards
    const cardsUnsubscribe = onSnapshot(
      collection(this.firestore!, `users/${userId}/cards`),
      (snapshot) => {
        const cards = snapshot.docs.map(doc => doc.data() as CreditCard);
        this.storageService.saveCards(cards);
      },
      (error) => {
        console.error('Error listening to cards:', error);
      }
    );
    this.unsubscribes.push(cardsUnsubscribe);

    // Listen to statements
    const statementsUnsubscribe = onSnapshot(
      collection(this.firestore!, `users/${userId}/statements`),
      (snapshot) => {
        const statements = snapshot.docs.map(doc => doc.data() as Statement);
        this.storageService.saveStatements(statements);
      },
      (error) => {
        console.error('Error listening to statements:', error);
      }
    );
    this.unsubscribes.push(statementsUnsubscribe);

    // Listen to installments
    const installmentsUnsubscribe = onSnapshot(
      collection(this.firestore!, `users/${userId}/installments`),
      (snapshot) => {
        const installments = snapshot.docs.map(doc => doc.data() as Installment);
        this.storageService.saveInstallments(installments);
      },
      (error) => {
        console.error('Error listening to installments:', error);
      }
    );
    this.unsubscribes.push(installmentsUnsubscribe);

    // Listen to cash installments
    const cashInstallmentsUnsubscribe = onSnapshot(
      collection(this.firestore!, `users/${userId}/cashInstallments`),
      (snapshot) => {
        const cashInstallments = snapshot.docs.map(doc => doc.data() as CashInstallment);
        this.storageService.saveCashInstallments(cashInstallments);
      },
      (error) => {
        console.error('Error listening to cash installments:', error);
      }
    );
    this.unsubscribes.push(cashInstallmentsUnsubscribe);

    // Listen to bank balances
    const bankBalancesUnsubscribe = onSnapshot(
      collection(this.firestore!, `users/${userId}/bankBalances`),
      (snapshot) => {
        const bankBalances = snapshot.docs.map(doc => doc.data() as BankBalance);
        this.storageService.saveBankBalances(bankBalances);
      },
      (error) => {
        console.error('Error listening to bank balances:', error);
      }
    );
    this.unsubscribes.push(bankBalancesUnsubscribe);

    // Listen to settings
    const settingsUnsubscribe = onSnapshot(
      doc(this.firestore!, `users/${userId}/settings/app`),
      (snapshot) => {
        if (snapshot.exists()) {
          const settings = snapshot.data();
          if (settings['bankBalanceTrackingEnabled'] !== undefined) {
            this.storageService.saveBankBalanceTrackingEnabled(settings['bankBalanceTrackingEnabled']);
          }
          if (settings['activeProfileId']) {
            this.storageService.saveActiveProfileId(settings['activeProfileId']);
          }
          if (settings['activeMonth']) {
            this.storageService.saveActiveMonthStr(settings['activeMonth']);
          }
        }
      },
      (error) => {
        console.error('Error listening to settings:', error);
      }
    );
    this.unsubscribes.push(settingsUnsubscribe);
  }

  /**
   * Stop listening to Firestore changes
   */
  private stopListening(): void {
    this.unsubscribes.forEach(unsubscribe => unsubscribe());
    this.unsubscribes = [];
    this.isListening = false;
  }

  private ensureInitialized(): void {
    if (!this.firestore) {
      throw new Error('Firestore not initialized. Call initialize() first.');
    }
  }
}
