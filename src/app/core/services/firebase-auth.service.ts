import { Injectable, signal } from '@angular/core';
import { 
  Auth, 
  User, 
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
} from '@angular/fire/auth';
import { firebaseConfig, isFirebaseConfigured } from '../../../environments/firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class FirebaseAuthService {
  authState = signal<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  private auth: Auth | null = null;

  constructor() {
    // Firebase auth will be lazily initialized
  }

  /**
   * Initialize Firebase Auth
   */
  async initialize(auth: Auth): Promise<void> {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase not configured. Please set environment variables.');
    }

    this.auth = auth;

    // Listen to auth state changes
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.authState.set({
          user: this.mapFirebaseUser(user),
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        this.authState.set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    });
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<void> {
    this.ensureInitialized();
    this.authState.update(state => ({ ...state, isLoading: true, error: null }));

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth!, provider);
      
      this.authState.update(state => ({
        ...state,
        user: this.mapFirebaseUser(result.user),
        isAuthenticated: true,
        isLoading: false,
      }));
    } catch (error: any) {
      this.authState.update(state => ({
        ...state,
        isLoading: false,
        error: error.message,
      }));
      throw error;
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<void> {
    this.ensureInitialized();
    this.authState.update(state => ({ ...state, isLoading: true, error: null }));

    try {
      const result = await signInWithEmailAndPassword(this.auth!, email, password);
      
      this.authState.update(state => ({
        ...state,
        user: this.mapFirebaseUser(result.user),
        isAuthenticated: true,
        isLoading: false,
      }));
    } catch (error: any) {
      this.authState.update(state => ({
        ...state,
        isLoading: false,
        error: this.getErrorMessage(error),
      }));
      throw error;
    }
  }

  /**
   * Create account with email and password
   */
  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<void> {
    this.ensureInitialized();
    this.authState.update(state => ({ ...state, isLoading: true, error: null }));

    try {
      const result = await createUserWithEmailAndPassword(this.auth!, email, password);
      
      // Update display name if provided
      if (displayName && result.user) {
        await updateProfile(result.user, { displayName });
      }

      this.authState.update(state => ({
        ...state,
        user: this.mapFirebaseUser(result.user),
        isAuthenticated: true,
        isLoading: false,
      }));
    } catch (error: any) {
      this.authState.update(state => ({
        ...state,
        isLoading: false,
        error: this.getErrorMessage(error),
      }));
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    this.ensureInitialized();

    try {
      await sendPasswordResetEmail(this.auth!, email);
    } catch (error: any) {
      throw new Error(this.getErrorMessage(error));
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    this.ensureInitialized();

    try {
      await firebaseSignOut(this.auth!);
      this.authState.set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      this.authState.update(state => ({
        ...state,
        error: error.message,
      }));
      throw error;
    }
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.authState().user?.uid ?? null;
  }

  /**
   * Check if Firebase is configured
   */
  isConfigured(): boolean {
    return isFirebaseConfigured();
  }

  private ensureInitialized(): void {
    if (!this.auth) {
      throw new Error('Firebase Auth not initialized. Call initialize() first.');
    }
  }

  private mapFirebaseUser(user: User): AuthUser {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    };
  }

  private getErrorMessage(error: any): string {
    const errorCode = error.code;
    
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'This email is already registered.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled.';
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 6 characters.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed.';
      default:
        return error.message || 'An error occurred during authentication.';
    }
  }
}
