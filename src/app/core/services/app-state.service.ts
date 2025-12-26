import { computed, Injectable, signal } from '@angular/core';
import { format, startOfMonth } from 'date-fns';

export type ModalType =
  | 'card-form'
  | 'installment-form'
  | 'one-time-bill'
  | 'profile-form'
  | 'transfer-card'
  | 'confirm'
  | null;

export interface ConfirmDialogState {
  title: string;
  message: string;
  variant?: 'warning' | 'danger' | 'info';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
}

export interface ModalState {
  type: ModalType;
  data?: any;
  confirmDialog?: ConfirmDialogState;
}

/**
 * Global application state service
 * Manages view date, multi-profile selection, and modal state
 */
@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  // View date management
  private _viewDate = signal<Date>(startOfMonth(new Date()));
  readonly viewDate = this._viewDate.asReadonly();
  readonly viewDateStr = computed(() => format(this._viewDate(), 'yyyy-MM-dd'));

  // Multi-profile mode
  private _multiProfileMode = signal<boolean>(false);
  readonly multiProfileMode = this._multiProfileMode.asReadonly();

  private _selectedProfileIds = signal<string[]>([]);
  readonly selectedProfileIds = this._selectedProfileIds.asReadonly();

  // Modal management
  private _modalState = signal<ModalState>({type: null});
  readonly modalState = this._modalState.asReadonly();

  constructor() {
    // Load saved preferences
    const savedMultiMode = localStorage.getItem('bt_multi_profile_mode');
    if (savedMultiMode === 'true') {
      this._multiProfileMode.set(true);
    }

    const savedProfileIds = localStorage.getItem('bt_selected_profile_ids');
    if (savedProfileIds) {
      try {
        const ids = JSON.parse(savedProfileIds);
        if (Array.isArray(ids)) {
          this._selectedProfileIds.set(ids);
        }
      } catch (e) {
        console.error('Failed to parse saved profile IDs');
      }
    }
  }

  /**
   * Navigate to previous month
   */
  previousMonth(): void {
    const current = this._viewDate();
    const year = current.getFullYear();
    const month = current.getMonth();
    this._viewDate.set(startOfMonth(new Date(year, month - 1, 1)));
  }

  /**
   * Navigate to next month
   */
  nextMonth(): void {
    const current = this._viewDate();
    const year = current.getFullYear();
    const month = current.getMonth();
    this._viewDate.set(startOfMonth(new Date(year, month + 1, 1)));
  }

  /**
   * Set view date
   */
  setViewDate(date: Date): void {
    this._viewDate.set(startOfMonth(date));
  }

  /**
   * Toggle multi-profile mode
   */
  toggleMultiProfileMode(): void {
    const newValue = !this._multiProfileMode();
    this._multiProfileMode.set(newValue);
    localStorage.setItem('bt_multi_profile_mode', String(newValue));

    // Clear selected profiles when disabling
    if (!newValue) {
      this._selectedProfileIds.set([]);
      localStorage.removeItem('bt_selected_profile_ids');
    }
  }

  /**
   * Set multi-profile mode
   */
  setMultiProfileMode(enabled: boolean): void {
    this._multiProfileMode.set(enabled);
    localStorage.setItem('bt_multi_profile_mode', String(enabled));

    if (!enabled) {
      this._selectedProfileIds.set([]);
      localStorage.removeItem('bt_selected_profile_ids');
    }
  }

  /**
   * Set selected profile IDs for multi-profile view
   */
  setSelectedProfileIds(ids: string[]): void {
    this._selectedProfileIds.set(ids);
    localStorage.setItem('bt_selected_profile_ids', JSON.stringify(ids));
  }

  /**
   * Toggle a profile ID in the selection
   */
  toggleProfileSelection(profileId: string): void {
    const current = this._selectedProfileIds();
    const index = current.indexOf(profileId);

    if (index === -1) {
      this.setSelectedProfileIds([...current, profileId]);
    } else {
      this.setSelectedProfileIds(current.filter(id => id !== profileId));
    }
  }

  /**
   * Open a modal
   */
  openModal(type: ModalType, data?: any): void {
    this._modalState.set({type, data});
  }

  /**
   * Close the current modal
   */
  closeModal(): void {
    this._modalState.set({type: null});
  }

  /**
   * Open card form modal (add or edit)
   */
  openCardForm(cardId?: string): void {
    this.openModal('card-form', {cardId});
  }

  /**
   * Open installment form modal (add or edit)
   */
  openInstallmentForm(installmentId?: string): void {
    this.openModal('installment-form', {installmentId});
  }

  /**
   * Open one-time bill modal (add or edit)
   */
  openOneTimeBillModal(billId?: string): void {
    this.openModal('one-time-bill', {billId});
  }

  /**
   * Open profile form modal
   */
  openProfileForm(): void {
    this.openModal('profile-form');
  }

  /**
   * Open transfer card modal
   */
  openTransferCardModal(cardId: string): void {
    this.openModal('transfer-card', {cardId});
  }

  /**
   * Open confirm dialog
   */
  openConfirmDialog(config: ConfirmDialogState): void {
    this._modalState.set({
      type: 'confirm',
      confirmDialog: config
    });
  }

  /**
   * Show a confirmation dialog
   */
  confirm(config: ConfirmDialogState): void {
    this.openConfirmDialog(config);
  }
}
