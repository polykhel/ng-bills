import { ChangeDetectionStrategy, Component, effect, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStateService, BankAccountService, ProfileService } from '@services';
import { ModalComponent } from './modal.component';
import type { BankAccount } from '../types';

@Component({
  selector: 'app-bank-account-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './bank-account-form-modal.component.html',
})
export class BankAccountFormModalComponent implements OnInit {
  form!: FormGroup;
  editingAccount = signal<BankAccount | null>(null);

  constructor(
    private fb: FormBuilder,
    private bankAccountService: BankAccountService,
    private profileService: ProfileService,
    public appState: AppStateService
  ) {
    // Watch for modal state changes to populate form
    effect(() => {
      const modalState = this.appState.modalState();
      if (modalState.type === 'bank-account-form') {
        const accountId = modalState.data?.accountId;
        if (accountId) {
          const account = this.bankAccountService.bankAccounts().find(a => a.id === accountId);
          this.editingAccount.set(account || null);
          if (account) {
            this.form.patchValue(account);
          }
        } else {
          this.editingAccount.set(null);
          this.form.reset({
            accountType: 'checking',
            color: '#334155',
            initialBalance: 0
          });
        }
      }
    });
  }

  get isOpen(): boolean {
    return this.appState.modalState().type === 'bank-account-form';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      bankName: ['', [Validators.required]],
      accountNumber: [''],
      accountType: ['checking', [Validators.required]],
      color: ['#334155', [Validators.required]],
      initialBalance: [0],
      maintainingBalance: [0]
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      const formValue = this.form.value;
      const activeProfileId = this.profileService.activeProfileId();
      const existingAccount = this.editingAccount();

      const accountData: Partial<BankAccount> & { id?: string } = {
        ...formValue,
        profileId: activeProfileId
      };

      if (this.editingAccount()) {
        const accountId = this.editingAccount()!.id;
        this.bankAccountService.updateBankAccount(accountId, accountData);
      } else {
        this.bankAccountService.addBankAccount(accountData as Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>);
      }

      this.close();
    }
  }

  close(): void {
    this.form.reset({
      accountType: 'checking',
      color: '#334155',
      initialBalance: 0,
      maintainingBalance: 0
    });
    this.editingAccount.set(null);
    this.appState.closeModal();
  }
}
