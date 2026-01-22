import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Edit2,
  FileText,
  Filter,
  LucideAngularModule,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-angular';
import {
  AppStateService,
  CardService,
  CategoryService,
  ProfileService,
  TransactionService,
} from '@services';
import { EmptyStateComponent, MetricCardComponent, QuickActionButtonComponent } from '@components';
import type { PaymentMethod, Transaction, TransactionFilter, TransactionType } from '@shared/types';
import { format, parseISO } from 'date-fns';

/**
 * Transactions Page Component
 * Displays all income and expense transactions with filtering
 * Auto-links credit card transactions to monthly bills
 */
@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    MetricCardComponent,
    QuickActionButtonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './transactions.component.html',
  styles: [
    `
      :host {
        display: block;
      }

      .transaction-form {
        background: rgb(249, 250, 251);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 24px;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
        margin-bottom: 12px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
      }

      .form-group label {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 6px;
        color: rgb(71, 85, 105);
      }

      .form-group input,
      .form-group select,
      .form-group textarea {
        padding: 8px;
        border: 1px solid rgb(226, 232, 240);
        border-radius: 4px;
        font-size: 14px;
      }

      .form-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        font-weight: 600;
      }

      .btn-primary {
        background: rgb(37, 99, 235);
        color: white;
      }

      .btn-secondary {
        background: white;
        border: 1px solid rgb(226, 232, 240);
        color: rgb(71, 85, 105);
      }

      .transaction-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        border-bottom: 1px solid rgb(226, 232, 240);
      }

      .transaction-info {
        flex: 1;
      }

      .transaction-description {
        font-weight: 600;
        color: rgb(15, 23, 42);
      }

      .transaction-meta {
        font-size: 12px;
        color: rgb(100, 116, 139);
        margin-top: 4px;
      }

      .transaction-amount {
        font-weight: 700;
        font-size: 16px;
        text-align: right;
        min-width: 100px;
      }

      .amount-expense {
        color: rgb(220, 38, 38);
      }

      .amount-income {
        color: rgb(34, 197, 94);
      }

      .transaction-actions {
        display: flex;
        gap: 8px;
        margin-left: 16px;
      }

      .icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        color: rgb(100, 116, 139);
      }
    `,
  ],
})
export class TransactionsComponent {
  readonly Plus = Plus;
  readonly Filter = Filter;
  readonly TrendingUp = TrendingUp;
  readonly TrendingDown = TrendingDown;
  readonly Wallet = Wallet;
  readonly FileText = FileText;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly X = X;

  private appState = inject(AppStateService);
  protected profileService = inject(ProfileService);
  // Form state
  protected showForm = false;
  protected formData: Partial<Transaction> = this.getEmptyForm();
  // Filter state
  protected filterType: TransactionType | 'all' = 'all';

  protected activeProfile = this.profileService.activeProfile;
  protected viewDate = this.appState.viewDate;
  protected filterPaymentMethod: PaymentMethod | 'all' = 'all';
  protected filterCardId: string | '' = '';
  // Computed summary
  protected summary = computed(() => {
    const transactions = this.filteredTransactions();

    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpenses,
      netChange: totalIncome - totalExpenses,
      transactionCount: transactions.length,
    };
  });
  private transactionService = inject(TransactionService);
  // Computed filtered transactions
  // Shows transactions where:
  // 1. User owns the transaction (profileId matches)
  // 2. User paid for it (paidByOtherProfileId matches current profile)
  protected filteredTransactions = computed(() => {
    const profile = this.activeProfile();
    if (!profile) return [];

    // Get all transactions from transaction service
    const allTransactions = this.transactionService.getTransactions();

    // Filter to transactions relevant to this profile
    let relevantTransactions = allTransactions.filter((t) => {
      // Include if this profile owns the transaction
      if (t.profileId === profile.id) return true;
      // Include if this profile paid for it (shared expense)
      if (t.paidByOtherProfileId === profile.id) return true;
      return false;
    });

    // Apply additional filters
    if (this.filterType !== 'all') {
      relevantTransactions = relevantTransactions.filter((t) => t.type === this.filterType);
    }

    if (this.filterPaymentMethod !== 'all') {
      relevantTransactions = relevantTransactions.filter(
        (t) => t.paymentMethod === this.filterPaymentMethod,
      );
    }

    if (this.filterCardId) {
      relevantTransactions = relevantTransactions.filter((t) => t.cardId === this.filterCardId);
    }

    return relevantTransactions;
  });
  private cardService = inject(CardService);
  protected cards = this.cardService.cards;
  private categoryService = inject(CategoryService);
  protected categories = this.categoryService.categories;

  protected onAddTransaction(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.formData = this.getEmptyForm();
    }
  }

  protected onFilter(): void {
    // Reset filters
    this.filterType = 'all';
    this.filterPaymentMethod = 'all';
    this.filterCardId = '';
  }

  protected async onSubmitTransaction(): Promise<void> {
    if (!this.validateForm()) {
      alert('Please fill in all required fields');
      return;
    }

    const profile = this.activeProfile();
    if (!profile) return;

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      type: (this.formData.type || 'expense') as TransactionType,
      amount: this.formData.amount || 0,
      date: this.formData.date || new Date().toISOString().split('T')[0],
      categoryId: this.formData.categoryId || 'uncategorized',
      description: this.formData.description || '',
      notes: this.formData.notes,
      paymentMethod: (this.formData.paymentMethod || 'cash') as PaymentMethod,
      cardId: this.formData.cardId,
      paidByOther: this.formData.paidByOther || false,
      paidByOtherProfileId: this.formData.paidByOtherProfileId,
      paidByOtherName: this.formData.paidByOtherName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.transactionService.addTransaction(transaction);
      this.showForm = false;
      this.formData = this.getEmptyForm();
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Failed to add transaction');
    }
  }

  protected async onDeleteTransaction(id: string): Promise<void> {
    if (!confirm('Delete this transaction?')) return;

    try {
      await this.transactionService.deleteTransaction(id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction');
    }
  }

  protected formatDate(dateStr: string): string {
    try {
      return format(parseISO(dateStr), 'MMM dd, yyyy');
    } catch {
      return dateStr;
    }
  }

  protected getCardName(cardId: string | undefined): string {
    if (!cardId) return '-';
    const card = this.cards().find((c) => c.id === cardId);
    return card ? `${card.bankName} ${card.cardName}` : 'Unknown Card';
  }

  protected getProfileName(profileId: string): string {
    const profile = this.profileService.profiles().find((p) => p.id === profileId);
    return profile?.name ?? 'Unknown';
  }

  /**
   * Get the label for who paid for this transaction
   * Shows profile name if linked, otherwise shows manual name
   */
  protected getPaidByLabel(transaction: Transaction): string {
    if (!transaction.paidByOther) return '';

    if (transaction.paidByOtherProfileId) {
      const profile = this.profileService.profiles().find((p) => p.id === transaction.paidByOtherProfileId);
      return profile ? profile.name : 'Unknown Profile';
    }

    return transaction.paidByOtherName || 'Other';
  }

  /**
   * Get context label for shared transactions
   * Shows different context depending on whether you own it or paid for it
   */
  protected getTransactionContext(transaction: Transaction): string {
    const profile = this.activeProfile();
    if (!profile) return '';

    if (transaction.profileId === profile.id && transaction.paidByOther) {
      // You own it but someone else paid
      const paidBy = this.getPaidByLabel(transaction);
      return `💳 Paid by ${paidBy}`;
    }

    if (transaction.paidByOtherProfileId === profile.id && transaction.profileId !== profile.id) {
      // You paid for someone else's transaction
      const owner = this.profileService.profiles().find((p) => p.id === transaction.profileId);
      return `💳 You paid for ${owner?.name || 'them'}`;
    }

    return '';
  }

  private validateForm(): boolean {
    return !!(
      this.formData.amount &&
      this.formData.amount > 0 &&
      this.formData.description &&
      this.formData.date
    );
  }

  private getEmptyForm(): Partial<Transaction> {
    return {
      type: 'expense',
      amount: undefined,
      date: new Date().toISOString().split('T')[0],
      description: '',
      paymentMethod: 'cash',
      categoryId: 'uncategorized',
      paidByOther: false,
      paidByOtherProfileId: undefined,
      paidByOtherName: '',
    };
  }
}
